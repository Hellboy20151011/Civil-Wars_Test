Create Table if not exists users (
id BIGSERIAL Primary KEY,

email Varchar(255) Not Null Unique,
username Varchar(50) Not Null Unique,

	password_hash Text not NULL,

	role varchar(30) not null default 'player',
	is_active Boolean not null default true,
	is_email_verified Boolean not null default false,

	created_at Timestamptz not null default now(),
	updated_at TIMESTAMPtZ not null default now(),
	last_login_at TIMESTAMPtZ
)