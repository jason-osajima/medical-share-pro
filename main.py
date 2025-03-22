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
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# Adding logging wrapper to the OCR process
async def preprocess_image(image: Image.Image) -> Image.Image:
    """Preprocess image to improve OCR accuracy."""
    try:
        logger.info("Starting image preprocessing")
        # Convert to grayscale
        image = image.convert('L')
        
        # Increase contrast
        image = image.point(lambda x: 0 if x < 128 else 255, '1')
        
        # Resize if too large (max 4000px on longest side)
        max_size = 4000
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.LANCZOS)
            logger.info(f"Resized image to {new_size}")
            
        return image
    except Exception as e:
        logger.error(f"Image preprocessing failed: {str(e)}")
        raise Exception(f"Failed to preprocess image: {str(e)}")

async def process_image_ocr(image: Image.Image) -> str:
    """Extract text from an image using pytesseract."""
    try:
        logger.info("Starting OCR processing for image")
        # Add version check
        version = pytesseract.get_tesseract_version()
        logger.info(f"Tesseract version: {version}")

        # Preprocess image
        image = await preprocess_image(image)
        
        # Add timeout mechanism
        async def ocr_task():
            return pytesseract.image_to_string(
                image,
                config='--psm 3 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?@#$%^&*()[]{}<>-_=+;:"/\\ '
            )

        # Set 30 second timeout
        text = await asyncio.wait_for(ocr_task(), timeout=30.0)
        
        if not text.strip():
            raise Exception("No text extracted from image")
            
        logger.info(f"OCR completed, extracted {len(text)} characters")
        return text
    except asyncio.TimeoutError:
        logger.error("OCR processing timed out after 30 seconds")
        raise Exception("OCR processing timed out. Please try again with a smaller or clearer image")
    except Exception as e:
        logger.error(f"OCR processing failed: {str(e)}")
        logger.error(f"Full error: {repr(e)}")
        raise Exception(f"Failed to extract text from image: {str(e)}")

async def process_pdf_ocr(pdf_path: str) -> str:
    """Convert PDF to images and extract text using pytesseract."""
    try:
        logger.info(f"Starting PDF processing: {pdf_path}")
        # Convert PDF pages to images
        logger.info("Converting PDF to images")
        images = convert_from_path(pdf_path)
        logger.info(f"Converted PDF to {len(images)} pages")

        # Process each page
        text_parts = []
        for i, image in enumerate(images, 1):
            logger.info(f"Processing page {i}/{len(images)}")
            page_text = await process_image_ocr(image)
            text_parts.append(f"--- Page {i} ---\n{page_text}\n")

        final_text = "\n".join(text_parts)
        logger.info(f"Completed PDF OCR, total characters: {len(final_text)}")
        return final_text
    except Exception as e:
        logger.error(f"PDF processing failed: {str(e)}")
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
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logger.info(f"Starting document upload: {file.filename}")
    
    # Enhanced file validation
    allowed_types = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'application/pdf': ['.pdf']
    }
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if not (file.content_type in allowed_types and file_ext in allowed_types[file.content_type]):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported formats: {', '.join([ext for exts in allowed_types.values() for ext in exts])}"
        )
        
    # Check file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB in bytes
        raise HTTPException(
            status_code=400,
            detail="File size exceeds maximum limit of 10MB"
        )
        
    # Save file with secure filename
    secure_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = f"uploads/{secure_filename}"
    logger.info(f"Saving file to: {file_path}")
    
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    # Create document
    db_document = models.Document(
        user_id=current_user.id,
        name=name,
        category=category,
        tags=json.dumps(json.loads(tags)),
        file_url=file_path,
        uploaded_at=datetime.utcnow(),
        ocr_status="pending"
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # Start OCR processing immediately
    logger.info(f"Starting OCR processing for document {db_document.id}")
    async def process_ocr():
        try:
            # Update status to processing
            db_document.ocr_status = "processing"
            db_document.ocr_error = None
            db.commit()

            # Verify file exists
            if not os.path.exists(db_document.file_url):
                error_msg = f"File not found at path: {db_document.file_url}"
                logger.error(error_msg)
                db_document.ocr_status = "error"
                db_document.ocr_error = error_msg
                db.commit()
                return

            logger.info(f"Found file at path: {db_document.file_url}")
            file_ext = os.path.splitext(db_document.file_url)[1].lower()
            logger.info(f"Processing file with extension: {file_ext}")

            # Process based on file type
            if file_ext == '.pdf':
                logger.info("Starting PDF processing")
                text = await process_pdf_ocr(db_document.file_url)
            else:  # Image file
                logger.info("Starting image processing")
                try:
                    image = Image.open(db_document.file_url)
                    logger.info(f"Successfully opened image: {db_document.file_url}")
                    text = await process_image_ocr(image)
                except Exception as e:
                    error_msg = f"Failed to open or process image: {str(e)}"
                    logger.error(error_msg)
                    raise Exception(error_msg)

            if not text or text.strip() == "":
                error_msg = "No text could be extracted from the document"
                logger.error(error_msg)
                raise Exception(error_msg)

            # Update document with OCR results
            logger.info(f"OCR completed successfully, extracted {len(text)} characters")
            db_document.ocr_text = text
            db_document.ocr_status = "completed"
            db.commit()
            logger.info(f"Database updated with OCR results for document {db_document.id}")

        except Exception as e:
            error_msg = str(e)
            logger.error(f"OCR Error for document {db_document.id}: {error_msg}")
            logger.error(f"Full error details: {repr(e)}")
            db_document.ocr_status = "error"
            db_document.ocr_error = error_msg
            db.commit()

    # Start OCR processing in background
    background_tasks.add_task(process_ocr)
    logger.info(f"OCR task scheduled for document {db_document.id}")

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
    logger.info(f"Starting OCR request for document {document_id}")

    # Get document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()

    if not document:
        logger.error(f"Document {document_id} not found")
        raise HTTPException(status_code=404, detail="Document not found")

    file_ext = os.path.splitext(document.file_url)[1].lower()
    logger.info(f"Document file extension: {file_ext}")

    if file_ext not in ['.pdf', '.png', '.jpg', '.jpeg']:
        logger.error(f"Unsupported file type: {file_ext}")
        raise HTTPException(
            status_code=400,
            detail="OCR is only supported for PDF and image files (PNG, JPG)"
        )

    async def process_ocr():
        try:
            logger.info(f"Starting OCR processing for document {document_id}")
            # Update status to processing
            document.ocr_status = "processing"
            document.ocr_error = None
            db.commit()

            # Verify file exists
            if not os.path.exists(document.file_url):
                error_msg = f"File not found at path: {document.file_url}"
                logger.error(error_msg)
                document.ocr_status = "error"
                document.ocr_error = error_msg
                db.commit()
                return

            logger.info(f"Found file at path: {document.file_url}")
            file_ext = os.path.splitext(document.file_url)[1].lower()
            logger.info(f"Processing file with extension: {file_ext}")

            # Process based on file type
            if file_ext == '.pdf':
                logger.info("Starting PDF processing")
                text = await process_pdf_ocr(document.file_url)
            else:  # Image file
                logger.info("Starting image processing")
                try:
                    image = Image.open(document.file_url)
                    logger.info(f"Successfully opened image: {document.file_url}")
                    text = await process_image_ocr(image)
                except Exception as e:
                    error_msg = f"Failed to open or process image: {str(e)}"
                    logger.error(error_msg)
                    raise Exception(error_msg)

            if not text or text.strip() == "":
                error_msg = "No text could be extracted from the document"
                logger.error(error_msg)
                raise Exception(error_msg)

            # Update document with OCR results
            logger.info(f"OCR completed successfully, extracted {len(text)} characters")
            document.ocr_text = text
            document.ocr_status = "completed"
            db.commit()
            logger.info(f"Database updated with OCR results for document {document_id}")

        except Exception as e:
            error_msg = str(e)
            logger.error(f"OCR Error for document {document_id}: {error_msg}")
            logger.error(f"Full error details: {repr(e)}")
            document.ocr_status = "error"
            document.ocr_error = error_msg
            db.commit()

    # Start OCR processing in background
    background_tasks.add_task(process_ocr)
    logger.info(f"OCR task scheduled for document {document_id}")

    return {"message": "OCR processing started"}

@app.get("/api/documents/{document_id}/ocr-status")
async def get_ocr_status(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.user_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "status": document.ocr_status,
        "error": document.ocr_error,
        "text_length": len(document.ocr_text) if document.ocr_text else 0
    }

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