from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MedicamentoViewSet,
    FornecedorViewSet,
    MovimentacaoViewSet,
    registrar_entrada,
    solicitar_recuperacao_senha,
    redefinir_senha,
    cadastrar_usuario,
    login_usuario,
)

router = DefaultRouter()
router.register(r"medicamentos", MedicamentoViewSet, basename="medicamentos")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedores")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacoes")

urlpatterns = [
    path("", include(router.urls)),
    path("registrar-entrada/", registrar_entrada, name="registrar_entrada"),
    path("recuperar-senha/", solicitar_recuperacao_senha, name="recuperar_senha"),
    path("redefinir-senha/", redefinir_senha, name="redefinir_senha"),
    path("cadastro/", cadastrar_usuario, name="cadastro"),
    path("login/", login_usuario, name="login"),
]