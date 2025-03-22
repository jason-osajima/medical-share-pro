from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True
    )