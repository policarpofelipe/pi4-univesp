"""identidade e acesso

Revision ID: 0001_identidade
Revises:
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_identidade"
down_revision = None
branch_labels = None
depends_on = None

TABELAS = {
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_unicode_ci",
}


def upgrade():
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("senha_hash", sa.String(length=255), nullable=False),
        sa.Column("perfil", sa.String(length=20), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("email_verificado_em", sa.DateTime(), nullable=True),
        sa.Column("tentativas_login_falhas", sa.Integer(), nullable=False),
        sa.Column("bloqueado_ate", sa.DateTime(), nullable=True),
        sa.Column("ultimo_login_em", sa.DateTime(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_usuarios_email"),
        **TABELAS,
    )

    op.create_table(
        "convites_usuarios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("criado_por_usuario_id", sa.Integer(), nullable=False),
        sa.Column("usuario_criado_id", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("expira_em", sa.DateTime(), nullable=False),
        sa.Column("utilizado_em", sa.DateTime(), nullable=True),
        sa.Column("cancelado_em", sa.DateTime(), nullable=True),
        sa.Column("email_enviado_em", sa.DateTime(), nullable=True),
        sa.Column("erro_envio_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["criado_por_usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["usuario_criado_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_convites_token_hash"),
        **TABELAS,
    )
    op.create_index("ix_convites_email", "convites_usuarios", ["email"])

    op.create_table(
        "sessoes_usuarios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("expira_em", sa.DateTime(), nullable=False),
        sa.Column("ultimo_acesso_em", sa.DateTime(), nullable=False),
        sa.Column("revogada_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_sessoes_token_hash"),
        **TABELAS,
    )
    op.create_index("ix_sessoes_usuario_id", "sessoes_usuarios", ["usuario_id"])


def downgrade():
    op.drop_index("ix_sessoes_usuario_id", table_name="sessoes_usuarios")
    op.drop_table("sessoes_usuarios")
    op.drop_index("ix_convites_email", table_name="convites_usuarios")
    op.drop_table("convites_usuarios")
    op.drop_table("usuarios")
