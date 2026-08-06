import os
from datetime import timedelta
from urllib.parse import quote_plus

from dotenv import load_dotenv


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    APP_ENV = os.environ.get('APP_ENV', 'development').lower()
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', '3306'))
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')
    MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'qiuzhao_db')

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or (
        'mysql+pymysql://'
        f'{MYSQL_USER}:{quote_plus(MYSQL_PASSWORD)}@{MYSQL_HOST}:{MYSQL_PORT}/'
        f'{MYSQL_DATABASE}?charset=utf8mb4'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 280,
    }
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-dev-secret-key-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.qq.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', '465'))
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'true').lower() == 'true'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or MAIL_USERNAME

    @classmethod
    def validate(cls):
        if cls.APP_ENV != 'production':
            return

        required = ['SECRET_KEY', 'JWT_SECRET_KEY', 'MAIL_USERNAME', 'MAIL_PASSWORD']
        if not os.environ.get('DATABASE_URL'):
            required.extend([
                'MYSQL_HOST',
                'MYSQL_USER',
                'MYSQL_PASSWORD',
                'MYSQL_DATABASE',
            ])

        missing = [name for name in required if not os.environ.get(name)]
        if missing:
            raise RuntimeError(
                'Missing required production environment variables: '
                + ', '.join(missing)
            )
