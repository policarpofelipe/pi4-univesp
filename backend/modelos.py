from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    perfil: Mapped[str] = mapped_column(String(20), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    email_verificado_em: Mapped[object] = mapped_column(DateTime, nullable=True)
    tentativas_login_falhas: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    bloqueado_ate: Mapped[object] = mapped_column(DateTime, nullable=True)
    ultimo_login_em: Mapped[object] = mapped_column(DateTime, nullable=True)
    criado_em: Mapped[object] = mapped_column(DateTime, nullable=False)
    atualizado_em: Mapped[object] = mapped_column(DateTime, nullable=False)

    sessoes: Mapped[list["SessaoUsuario"]] = relationship(back_populates="usuario")


class ConviteUsuario(Base):
    __tablename__ = "convites_usuarios"
    __table_args__ = (UniqueConstraint("token_hash", name="uq_convites_token_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    criado_por_usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id"), nullable=False
    )
    usuario_criado_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id"), nullable=True
    )
    criado_em: Mapped[object] = mapped_column(DateTime, nullable=False)
    expira_em: Mapped[object] = mapped_column(DateTime, nullable=False)
    utilizado_em: Mapped[object] = mapped_column(DateTime, nullable=True)
    cancelado_em: Mapped[object] = mapped_column(DateTime, nullable=True)
    email_enviado_em: Mapped[object] = mapped_column(DateTime, nullable=True)
    erro_envio_em: Mapped[object] = mapped_column(DateTime, nullable=True)


class SessaoUsuario(Base):
    __tablename__ = "sessoes_usuarios"
    __table_args__ = (UniqueConstraint("token_hash", name="uq_sessoes_token_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    criado_em: Mapped[object] = mapped_column(DateTime, nullable=False)
    expira_em: Mapped[object] = mapped_column(DateTime, nullable=False)
    ultimo_acesso_em: Mapped[object] = mapped_column(DateTime, nullable=False)
    revogada_em: Mapped[object] = mapped_column(DateTime, nullable=True)

    usuario: Mapped[Usuario] = relationship(back_populates="sessoes")
