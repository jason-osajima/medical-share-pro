import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import openai
import asyncio
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import json
from typing import List, Optional

import models
import schemas
from database import engine, get_db
from auth import authenticate_user, create_access_token, get_current_user, get_password_hash

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(title="Medical Document Management System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for document uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

async def process_image_ocr(image: Image.Image) -> str:
    """Extract text from an image using pytesseract."""
    try:
        return pytesseract.image_to_string(image)
    except Exception as e:
        raise Exception(f"Failed to extract text from image: {str(e)}")

async def process_pdf_ocr(pdf_path: str) -> str:
    """Convert PDF to images and extract text using pytesseract."""
    try:
        # Convert PDF pages to images
        images = convert_from_path(pdf_path)

        # Process each page
        text_parts = []
        for i, image in enumerate(images, 1):
            page_text = await process_image_ocr(image)
            text_parts.append(f"--- Page {i} ---\n{page_text}\n")

        return "\n".join(text_parts)
    except Exception as e:
        raise Exception(f"Failed to process PDF: {str(e)}")

# Auth routes
@app.post("/api/register", response_model=schemas.User)
async def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = models.User(
        username=user_data.username,
        password=hashed_password,
        totp_enabled=False,
        totp_verified=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/user", response_model=schemas.User)
async def get_user(current_user: models.User = Depends(get_current_user)):
    return current_user

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Document management routes
@app.post("/api/documents", response_model=schemas.Document)
async def create_document(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: str = Form(...),
    tags: str = Form(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tags_list = json.loads(tags)

    # Validate file type
    if not file.content_type in ['image/jpeg', 'image/png', 'application/pdf']:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only JPEG, PNG, and PDF files are supported."
        )

    # Save file
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Create document
    db_document = models.Document(
        user_id=current_user.id,
        name=name,
        category=category,
        tags=json.dumps(tags_list),
        file_url=file_path,
        uploaded_at=datetime.utcnow(),
        ocr_status="pending"
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

@app.get("/api/documents", response_model=List[schemas.Document])
async def get_documents(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    query: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[str] = None
):
    documents = db.query(models.Document).filter(models.Document.user_id == current_user.id)

    if query:
        documents = documents.filter(
            (models.Document.name.ilike(f"%{query}%")) |
            (models.Document.ocr_text.ilike(f"%{query}%"))
        )

    if category:
        documents = documents.filter(models.Document.category == category)

    if tags:
        tags_list = json.loads(tags)
        for tag in tags_list:
            documents = documents.filter(models.Document.tags.contains(tag))

    return documents.all()

@app.post("/api/documents/{document_id}/process-ocr")
async def process_document_ocr(
    document_id: int,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_ext = os.path.splitext(document.file_url)[1].lower()
    if file_ext not in ['.pdf', '.png', '.jpg', '.jpeg']:
        raise HTTPException(
            status_code=400, 
            detail="OCR is only supported for PDF and image files (PNG, JPG)"
        )

    async def process_ocr():
        try:
            # Update status to processing
            document.ocr_status = "processing"
            document.ocr_error = None
            db.commit()

            # Process based on file type
            if file_ext == '.pdf':
                text = await process_pdf_ocr(document.file_url)
            else:  # Image file
                image = Image.open(document.file_url)
                text = await process_image_ocr(image)

            if not text or text.strip() == "":
                raise Exception("No text could be extracted from the document")

            # Update document with OCR results
            document.ocr_text = text
            document.ocr_status = "completed"
            db.commit()

        except Exception as e:
            document.ocr_status = "error"
            document.ocr_error = str(e)
            db.commit()
            print(f"OCR Error for document {document_id}: {str(e)}")

    # Start OCR processing in background
    background_tasks.add_task(process_ocr)

    return {"message": "OCR processing started"}

@app.post("/api/documents/{document_id}/summarize")
async def summarize_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.ocr_text:
        raise HTTPException(status_code=400, detail="No OCR text available for summarization")

    async def generate_summary():
        try:
            # Update status to processing
            document.summary_status = "processing"
            document.summary_error = None
            db.commit()

            # Configure OpenAI
            openai.api_key = os.getenv("OPENAI_API_KEY")

            # Generate summary using OpenAI
            completion = await openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a medical document summarizer. Focus on extracting key medical information, dates, diagnoses, medications, and important details from medical documents."
                    },
                    {
                        "role": "user",
                        "content": f"Please summarize the following medical document text:\n\n{document.ocr_text}"
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )

            summary = completion.choices[0].message.content

            # Update document with summary
            document.summary = summary
            document.summary_status = "completed"
            db.commit()

        except Exception as e:
            document.summary_status = "error"
            document.summary_error = str(e)
            db.commit()
            print(f"Summary Error for document {document_id}: {str(e)}")

    # Start summary generation in background
    background_tasks.add_task(generate_summary)

    return {"message": "Summary generation started"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True
    )