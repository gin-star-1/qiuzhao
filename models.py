from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash


db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    applications = db.relationship('Application', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class EmailCode(db.Model):
    __tablename__ = 'email_codes'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    code = db.Column(db.String(4), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)


class Application(db.Model):
    __tablename__ = 'applications'

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    company = db.Column(db.String(120), nullable=False)
    position = db.Column(db.String(120), nullable=False)
    job_type = db.Column(db.String(40), default='开发')
    city = db.Column(db.String(60), default='')
    apply_date = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(40), default='已投递')
    next_event = db.Column(db.String(40), default='')
    next_date = db.Column(db.String(20), default='')
    deadline = db.Column(db.String(20), default='')  # 网申截止日期
    remark = db.Column(db.Text, default='')
    logo_url = db.Column(db.String(512), default='')

    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'company': self.company,
            'position': self.position,
            'jobType': self.job_type,
            'city': self.city,
            'applyDate': self.apply_date,
            'status': self.status,
            'nextEvent': self.next_event,
            'nextDate': self.next_date,
            'deadline': self.deadline,
            'remark': self.remark,
            'logoUrl': self.logo_url,
            'username': self.user.username if self.user else None,
            'userId': self.user_id,
            'sharedNotes': self.get_company_shared_notes(),
            'companyId': self.get_company_id()
        }

    def get_company_shared_notes(self):
        company = Company.query.filter_by(name=self.company).first()
        return company.shared_notes if company else ''

    def get_company_id(self):
        company = Company.query.filter_by(name=self.company).first()
        return company.id if company else None


class ApplicationHistory(db.Model):
    __tablename__ = 'application_history'

    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.String(64), db.ForeignKey('applications.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    field = db.Column(db.String(40), nullable=False)  # 变更的字段，如 status、nextEvent 等
    old_value = db.Column(db.Text, default='')
    new_value = db.Column(db.Text, default='')
    note = db.Column(db.Text, default='')  # 可选备注

    created_at = db.Column(db.DateTime, server_default=db.func.now())

    user = db.relationship('User')
    application = db.relationship('Application', backref=db.backref('histories', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'applicationId': self.application_id,
            'username': self.user.username if self.user else None,
            'field': self.field,
            'oldValue': self.old_value,
            'newValue': self.new_value,
            'note': self.note,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class Company(db.Model):
    __tablename__ = 'companies'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    shared_notes = db.Column(db.Text, default='')  # 共享面经/备注
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'sharedNotes': self.shared_notes,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }
