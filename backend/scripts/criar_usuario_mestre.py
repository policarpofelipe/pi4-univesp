import getpass
import sys
from pathlib import Path

from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config
from banco import SessaoLocal
from datas import agora_utc
from modelos import Usuario
from seguranca import hash_senha, normalizar_email, senha_valida


def criar_usuario_mestre():
    sessao: Session = SessaoLocal()
    try:
        if sessao.query(Usuario).filter(Usuario.perfil == "mestre").first():
            print("Já existe um usuário mestre. Nada foi alterado.")
            return 1

        padrao = config.NOME_MESTRE_PADRAO
        nome = input(f"Nome [{padrao}]: ").strip()
        if not nome:
            nome = padrao

        email = normalizar_email(input("E-mail: "))
        if not email:
            print("E-mail obrigatório.")
            return 1

        if sessao.query(Usuario).filter(Usuario.email == email).first():
            print("Este e-mail já está cadastrado. Nada foi alterado.")
            return 1

        senha = getpass.getpass("Senha: ")
        confirmacao = getpass.getpass("Confirmar senha: ")
        if senha != confirmacao:
            print("As senhas não coincidem.")
            return 1
        if not senha_valida(senha):
            print(
                f"A senha deve ter entre {config.SENHA_MINIMO} e {config.SENHA_MAXIMO} caracteres."
            )
            return 1

        agora = agora_utc()
        usuario = Usuario(
            nome=nome,
            email=email,
            senha_hash=hash_senha(senha),
            perfil="mestre",
            ativo=True,
            email_verificado_em=agora,
            tentativas_login_falhas=0,
            criado_em=agora,
            atualizado_em=agora,
        )
        sessao.add(usuario)
        sessao.commit()
        print("Usuário mestre criado.")
        return 0
    finally:
        sessao.close()


if __name__ == "__main__":
    sys.exit(criar_usuario_mestre())
