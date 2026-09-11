import html
import smtplib
import ssl
from email.message import EmailMessage

import config


class FalhaEnvioEmail(Exception):
    pass


def enviar_convite(nome, email, link, horas_expiracao):
    mensagem = EmailMessage()
    mensagem["Subject"] = "Convite para o PI4 UNIVESP"
    mensagem["From"] = f"PI4 UNIVESP <{config.SMTP_FROM}>"
    mensagem["To"] = email

    texto = (
        f"Olá, {nome}.\n\n"
        "Você foi convidado(a) a acessar o PI4 UNIVESP — "
        "Análise de Dados do Suporte Técnico.\n\n"
        "Ao abrir o link abaixo, você definirá a sua própria senha. "
        f"O convite expira em {horas_expiracao} horas.\n\n"
        f"{link}\n\n"
        "Se você não reconhece este convite, ignore esta mensagem.\n"
    )
    nome_html = html.escape(nome, quote=True)
    link_html = html.escape(link, quote=True)
    html_corpo = f"""\
<p>Olá, {nome_html}.</p>
<p>Você foi convidado(a) a acessar o PI4 UNIVESP — Análise de Dados do
Suporte Técnico.</p>
<p>Ao abrir o link, você definirá a sua própria senha. O convite expira
em {horas_expiracao} horas.</p>
<p><a href="{link_html}">Definir senha e acessar</a></p>
<p>Se você não reconhece este convite, ignore esta mensagem.</p>
"""
    mensagem.set_content(texto)
    mensagem.add_alternative(html_corpo, subtype="html")

    contexto = ssl.create_default_context()
    try:
        if config.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(
                config.SMTP_HOST, config.SMTP_PORT, context=contexto
            ) as smtp:
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                smtp.send_message(mensagem)
        else:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as smtp:
                smtp.starttls(context=contexto)
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                smtp.send_message(mensagem)
    except Exception as erro:
        raise FalhaEnvioEmail("Falha ao enviar o e-mail de convite.") from erro
