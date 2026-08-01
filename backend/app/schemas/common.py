from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class Role(str, Enum):
    ADMIN = "admin"
    TEAM_LEADER = "team_leader"
    AGENT = "agent"


class PoolName(str, Enum):
    RECRUITMENT = "recruitment"
    CREDIT_CARD_SALES = "credit_card_sales"
    CUSTOMER_SUPPORT = "customer_support"


class LeadStatus(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    FOLLOW_UP = "follow_up"
    QUALIFIED = "qualified"
    NOT_INTERESTED = "not_interested"
    CLOSED = "closed"


class CallDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class CallOutcome(str, Enum):
    ANSWERED = "answered"
    MISSED = "missed"
    TRANSFERRED = "transferred"
    VOICEMAIL = "voicemail"
    NOT_INTERESTED = "not_interested"
    QUALIFIED = "qualified"
    FOLLOW_UP_REQUIRED = "follow_up_required"


class MonitorAction(str, Enum):
    LISTEN = "listen"
    WHISPER = "whisper"
    BARGE = "barge"
    TRANSFER = "transfer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: Role
    pool_id: Optional[str] = None
    supervisor_id: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = "active"
    language: Optional[str] = "English"
    shift: Optional[str] = None
    skills: Optional[list[str]] = Field(default_factory=list)
    voice_model: Optional[str] = None
    ai_configuration: Optional[dict] = Field(default_factory=dict)


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    employee_id: str
    name: str
    email: EmailStr
    role: Role
    pool_id: Optional[str] = None
    supervisor_id: Optional[str] = None
    is_active: bool = True
    department: Optional[str] = None
    status: Optional[str] = "active"
    language: Optional[str] = "English"
    shift: Optional[str] = None
    skills: Optional[list[str]] = None
    voice_model: Optional[str] = None
    ai_configuration: Optional[dict] = None


class PoolCreate(BaseModel):
    name: PoolName
    description: Optional[str] = None


class CampaignCreate(BaseModel):
    name: str
    pool_id: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    campaign_type: Optional[str] = "outbound"
    languages: Optional[list[str]] = Field(default_factory=list)
    supervisor_id: Optional[str] = None
    agent_ids: Optional[list[str]] = Field(default_factory=list)
    ai_voice: Optional[str] = None
    calling_hours: Optional[str] = "9 AM - 6 PM"
    max_retry: Optional[int] = 3
    retry_interval: Optional[int] = 30
    status: Optional[str] = "active"


class LeadCreate(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    pool_id: str
    campaign_id: Optional[str] = None
    source: Optional[str] = "manual"
    extra: Optional[dict] = Field(default_factory=dict)


class LeadAssign(BaseModel):
    lead_ids: list[str]
    agent_id: str


class DispositionUpdate(BaseModel):
    status: LeadStatus
    sub_disposition: Optional[str] = None
    notes: Optional[str] = None
    follow_up_at: Optional[datetime] = None


class CallStart(BaseModel):
    lead_id: str
    direction: CallDirection


class CallEnd(BaseModel):
    call_id: str
    outcome: CallOutcome
    duration_seconds: int
    notes: Optional[str] = None
    ai_summary: Optional[str] = None
    transcript: Optional[str] = None


class LeaveRequestCreate(BaseModel):
    reason: str
    start_date: datetime
    end_date: datetime


class LeaveDecision(BaseModel):
    approve: bool
    remarks: Optional[str] = None


class PoolTransferRequestPayload(BaseModel):
    agent_id: str
    target_pool_id: str
    reason: str


class PoolTransferDecisionPayload(BaseModel):
    approved: bool
    remarks: Optional[str] = None


class CallQualityEvaluation(BaseModel):
    coaching_notes: str
    ai_quality_score: int
    compliance_score: int
    sentiment: str


class AssignSupervisorPayload(BaseModel):
    supervisor_id: Optional[str] = None
    agent_ids: list[str]


class BulkAssignPoolPayload(BaseModel):
    pool_id: str
    user_ids: list[str]


class ManualDialPayload(BaseModel):
    phone: str
    name: Optional[str] = None
    pool_id: str
    language: str
    agent_assign_mode: str
    assigned_agent_id: Optional[str] = None
    priority: str
    notes: Optional[str] = None


class ManualCallActionPayload(BaseModel):
    action: str


class ManualCallTransferPayload(BaseModel):
    target_agent_id: str


class ManualDTMFPayload(BaseModel):
    digit: str


class ManualConferencePayload(BaseModel):
    invitee_agent_id: str



