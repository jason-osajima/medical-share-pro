from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, Table
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    totp_verified = Column(Boolean, default=False)
    
    # Relationships
    documents = relationship("Document", back_populates="user")
    appointments = relationship("Appointment", back_populates="user")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    category = Column(String)
    tags = Column(String)  # Store as JSON string
    file_url = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    ocr_text = Column(Text, nullable=True)
    ocr_status = Column(String, default="pending")
    ocr_error = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    summary_status = Column(String, default="pending")
    summary_error = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="documents")
    share_links = relationship("ShareLink", back_populates="document")

class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    token = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    access_count = Column(Integer, default=0)
    max_accesses = Column(Integer, nullable=True)

    # Relationships
    document = relationship("Document", back_populates="share_links")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    date = Column(DateTime)
    notes = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="appointments")
