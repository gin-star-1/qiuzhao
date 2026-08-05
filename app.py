import os
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS

from config import Config
from models import db, User, Application, ApplicationHistory


app = Flask(__name__, static_folder='static')
app.config.from_object(Config)

# 允许跨域，开发时前端独立运行也能访问
CORS(app)

# 初始化数据库和 JWT
db.init_app(app)
jwt = JWTManager(app)


def generate_id():
    import uuid
    return 'app-' + uuid.uuid4().hex[:12]


# ---------------- 静态页面 ----------------

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)


# ---------------- 认证接口 ----------------

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'message': '用户名和密码不能为空'}), 400

    if len(password) < 6:
        return jsonify({'message': '密码长度至少 6 位'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': '用户名已存在'}), 409

    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=user.id)
    return jsonify({
        'message': '注册成功',
        'token': token,
        'user': user.to_dict()
    }), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'message': '用户名或密码错误'}), 401

    token = create_access_token(identity=user.id)
    return jsonify({
        'message': '登录成功',
        'token': token,
        'user': user.to_dict()
    })


@app.route('/api/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': '用户不存在'}), 404
    return jsonify(user.to_dict())


# ---------------- 投递记录接口 ----------------

@app.route('/api/applications', methods=['GET'])
@jwt_required()
def get_applications():
    # 所有登录用户都可以看到全部投递记录
    apps = Application.query.order_by(Application.apply_date.desc()).all()
    return jsonify([a.to_dict() for a in apps])


@app.route('/api/applications', methods=['POST'])
@jwt_required()
def create_application():
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    required = ['company', 'position', 'applyDate', 'status']
    for field in required:
        if not data.get(field):
            return jsonify({'message': f'{field} 不能为空'}), 400

    app_record = Application(
        id=generate_id(),
        user_id=user_id,
        company=data.get('company', '').strip(),
        position=data.get('position', '').strip(),
        job_type=data.get('jobType', '开发'),
        city=data.get('city', '').strip(),
        apply_date=data.get('applyDate'),
        status=data.get('status'),
        next_event=data.get('nextEvent', ''),
        next_date=data.get('nextDate', ''),
        remark=data.get('remark', ''),
        logo_url=data.get('logoUrl', '')
    )
    db.session.add(app_record)
    db.session.flush()

    # 记录初始状态
    history = ApplicationHistory(
        application_id=app_record.id,
        user_id=user_id,
        field='status',
        old_value='',
        new_value=app_record.status,
        note='创建投递记录'
    )
    db.session.add(history)
    db.session.commit()

    return jsonify(app_record.to_dict()), 201


@app.route('/api/applications/<app_id>', methods=['PUT'])
@jwt_required()
def update_application(app_id):
    user_id = get_jwt_identity()
    app_record = Application.query.filter_by(id=app_id, user_id=user_id).first()
    if not app_record:
        return jsonify({'message': '记录不存在'}), 404

    data = request.get_json() or {}

    # 记录变更前状态
    old_status = app_record.status
    old_next_event = app_record.next_event

    app_record.company = data.get('company', app_record.company).strip()
    app_record.position = data.get('position', app_record.position).strip()
    app_record.job_type = data.get('jobType', app_record.job_type)
    app_record.city = data.get('city', app_record.city).strip()
    app_record.apply_date = data.get('applyDate', app_record.apply_date)
    app_record.status = data.get('status', app_record.status)
    app_record.next_event = data.get('nextEvent', app_record.next_event)
    app_record.next_date = data.get('nextDate', app_record.next_date)
    app_record.remark = data.get('remark', app_record.remark)
    app_record.logo_url = data.get('logoUrl', app_record.logo_url)

    # 记录状态变更历史
    if old_status != app_record.status:
        history = ApplicationHistory(
            application_id=app_record.id,
            user_id=user_id,
            field='status',
            old_value=old_status,
            new_value=app_record.status,
            note='更新进度'
        )
        db.session.add(history)

    if old_next_event != app_record.next_event:
        history = ApplicationHistory(
            application_id=app_record.id,
            user_id=user_id,
            field='nextEvent',
            old_value=old_next_event,
            new_value=app_record.next_event,
            note='更新下一步事件'
        )
        db.session.add(history)

    db.session.commit()
    return jsonify(app_record.to_dict())


@app.route('/api/applications/<app_id>', methods=['DELETE'])
@jwt_required()
def delete_application(app_id):
    user_id = get_jwt_identity()
    app_record = Application.query.filter_by(id=app_id, user_id=user_id).first()
    if not app_record:
        return jsonify({'message': '记录不存在'}), 404

    db.session.delete(app_record)
    db.session.commit()
    return jsonify({'message': '删除成功'})


@app.route('/api/applications/<app_id>/history', methods=['GET'])
@jwt_required()
def get_application_history(app_id):
    histories = ApplicationHistory.query.filter_by(application_id=app_id).order_by(ApplicationHistory.created_at.desc()).all()
    return jsonify([h.to_dict() for h in histories])


# ---------------- 数据迁移/初始化 ----------------

@app.route('/api/seed', methods=['POST'])
@jwt_required()
def seed_data():
    """把前端 initial_data.js 中的数据批量导入当前用户账号。"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    items = data.get('data', [])

    count = 0
    for item in items:
        if not item.get('company') or not item.get('applyDate'):
            continue
        app_record = Application(
            id=item.get('id') or generate_id(),
            user_id=user_id,
            company=item.get('company'),
            position=item.get('position', ''),
            job_type=item.get('jobType', '开发'),
            city=item.get('city', ''),
            apply_date=item.get('applyDate'),
            status=item.get('status', '已投递'),
            next_event=item.get('nextEvent', ''),
            next_date=item.get('nextDate', ''),
            remark=item.get('remark', ''),
            logo_url=item.get('logoUrl', '')
        )
        db.session.add(app_record)
        count += 1

    db.session.commit()
    return jsonify({'message': f'成功导入 {count} 条记录'}), 201


# ---------------- 启动 ----------------

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
