# Tutor IA 1.3.0 — perfil escolar e contexto das fotografias

Implementação sobre a estabilização 1.2.0. Android versionCode 9, identidade e
certificado de release preservados. A versão não foi publicada.

## Idioma e ensino

- Definições dos pais com pt-PT/pt-BR, Portugal/Brasil, ano escolar e currículo
  nacional correspondente ou internacional.
- Adapta o prompt nos percursos SDK, servidor e HTTP nativo, sem permitir ao cliente
  escolher modelo ou endpoint.
- Inclui ensino secundário em Portugal e ensino médio no Brasil. O ano é uma
  referência de nível, sem recolher a idade real ou a data de nascimento.
- Interface principal, ditado, leitura, datas e dicas locais acompanham a variante.
  Os contactos de apoio seguem o país. Vozes dependem do dispositivo.
- Perfil guardado junto das definições protegidas pelo PIN. Configurações anteriores
  conservam chave/PIN e adotam o perfil inicial pt-PT, Portugal, 7.º ano.
- No Android, uma falha de migração do cofre conserva a chave legada mesmo depois
  de atualizar PIN/perfil. A limpeza só ocorre após confirmação ou eliminação explícita.

## Contexto das fotografias

- Uma resposta com fotografias pode incluir transcrição estruturada dos enunciados,
  resumo e referência a cada fotografia. A geração usa a mesma chamada do tutor;
  resposta e contexto são moderados em conjunto.
- Guarda o contexto na conversa e usa-o nas perguntas seguintes e em Não entendi,
  incluindo depois de reabrir a app. O painel permite consultar a transcrição.
- Mantém apenas o último grupo: até quatro fotografias, oito enunciados e 5000
  caracteres de contexto. Imagens anteriores não são guardadas nem reenviadas.
- Enunciados são dados não confiáveis, nunca instruções do tutor. JSON incompleto,
  contexto inválido ou falha de moderação não originam um novo contexto guardado.
- Uma nova leitura aprovada substitui o contexto anterior; se não houver enunciados
  legíveis, o contexto anterior é retirado. Limpar/apagar elimina também o resumo,
  e pedidos invalidados não o fazem reaparecer.

## Compatibilidade e validação

Uma variante Tutor IA Teste, com identidade com.tutoria.estudos.preview, permite
instalar as funcionalidades ao lado da versão existente. Usa dados/configuração
próprios. O CI compila e verifica este APK e guarda-o no artefacto tutor-ia-teste.

Atualizar também o backend do modo Servidor. O contrato novo usa clientVersion 3;
os clientes anteriores continuam a receber respostas simples e o perfil pedagógico
anterior quando não enviam um perfil. O APK debug não atualiza a app release.

Os pedidos com fotografia permitem até 4096 tokens de saída para acomodar a resposta
e os enunciados; o contexto de seguimento tem o limite separado indicado acima.
O currículo orienta a linguagem e a dificuldade, sem garantir cobertura oficial de
todas as metas. A qualidade das dicas e da transcrição requer avaliação real.

Não foram acrescentados novos testes automáticos nesta entrega. As evidências da
1.2.0 não demonstram o comportamento das funcionalidades novas. Confirmar os
cenários do [guião de validação final](GUIAO_VALIDACAO_FINAL.md), com Gemini real,
Android físico e atualização assinada, antes da distribuição.

## Verificações de implementação

Node 22: TypeScript, ESLint, build de servidor e export estático passaram. Capacitor
sync e build Android debug passaram com Java 21 e SDK/Build Tools 36. O APK debug
teve identidade, versão 1.3.0, versionCode 9 e assinatura verificadas. YAML e shell
dos workflows foram verificados. Estas verificações não usam Gemini real.
