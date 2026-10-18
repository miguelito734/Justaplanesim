# JustaPlaneSim — sandbox alpha 0.1

## Disponível

- Next.js, React, TypeScript e React Three Fiber. Aeroporto estilizado inspirado em Guarulhos, não uma reprodução geográfica operacional.
- Duas pistas, ligações de táxi, pátio, terminal, carga, hangares, torre, veículos e aeronaves estáticos.
- Catálogo de 22 aeronaves. Modelos procedurais com dimensões individuais, asas, motores e variantes geométricas. Nenhum modelo é uma reprodução de engenharia.
- Física básica em passo fixo de 1/60 s para 18 aeronaves motorizadas: inércia, empuxo, sustentação, gravidade, arrasto, frenagem, combustível, atitude, estol aproximado, flaps e trem.
- Colisões aproximadas com edifícios, limites da área de teste e critérios simplificados de toque na pista.
- Câmera orbital com pan, rotação, zoom, visão geral e acompanhamento. Comandos de teclado e direcionais por toque; potência no painel de instrumentos.
- GND e TWR automatizados locais: solicitação, emissão e cotejamento determinístico. Autorizações distintas para táxi, decolagem e pouso. APP e ACC têm apenas seleção de canal e transferência simulada.
- Missões de teste de táxi e ciclo de voo, com objetivos físicos, falha por colisão/violação e histórico local. Nenhum XP oficial é concedido.
- Check-in e embarque com validação de voo, passageiro, duplicidade e dependência de check-in; caso de bagagem com transições sequenciais. São tarefas locais de teste, sem NPCs físicos.
- Perfil local versionado, validação de dados e migração mínima v0 → v1. Preferências gráficas, nome, função e aeronave são persistidos. Sessão física e operações de passageiros não sobrevivem a recarregamento.

## Parcial ou planejado

- Balão, ASK 21, paramotor e dirigível: somente modelos visuais, com motores/voo desabilitados. Catálogo não equivale a física implementada.
- Sistemas individuais detalhados, combustível por tanque, efeitos meteorológicos, acústica, animação de flaps, trem com cinemática e hélices animadas: não implementados.
- Aerodinâmica de baixa fidelidade, atmosfera padrão, sem vento. IAS aproximada. Altitude exibida é AGL. Rumo é relativo ao eixo do cenário e não à orientação geográfica real de GRU. Frequências são simuladas.
- Não há colisão precisa entre asas, outros aviões e veículos decorativos; não há ocupação compartilhada nem separação entre múltiplas aeronaves controladas.
- Posição de teste no pátio é genérica para o maior porte; não há atribuição automática de portão por porte.
- Rampa física, marshaller, pushback, veículos dirigíveis e administração: planejados e indisponíveis na interface.
- Carreira oficial, avaliações, desbloqueios, recompensas, licenças e permissões administrativas: requisitos representados, sem concessão de licença ou progressão ativa.
- ILS, VOR, NDB, GNSS, SID/STAR, FMS e piloto automático: não implementados.
- APP/ACC completos, radar ATC, planos de voo, separação de tráfego e cancelamento de autorização: planejados.
- Multiplayer, autenticação e servidor autoritativo: inexistentes nesta versão. Não há jogadores online simulados. O estado TypeScript serializável e o motor independente da UI oferecem uma base de integração, não um protocolo de rede implementado.
- Teclas remapeáveis e joystick analógico: planejados; o celular utiliza direcionais de toque.

## Referência e segurança

Página oficial consultada: https://publicacoes.decea.mil.br/publicacao/mca-100-16 — MCA 100-16, em vigor em 08/05/2025; o portal informa alteração prevista para 26/11/2026. A página de publicação foi verificada; não foi realizada auditoria integral das frases do jogo contra todos os anexos do manual. A biblioteca inicial é uma abstração didática e NÃO declara conformidade oficial. Não usar este jogo para treinamento real.

Dados locais podem ser adulterados. Uma implementação online deverá validar identidade, permissões, progressão, autorizações e física em servidor autoritativo.

## Verificações

Os testes em `lib/sim/engine.test.ts` cobrem catálogo, imobilidade sem motor, validação de cotejamento, ciclo físico C152 com controles numéricos, colisão com edifício, objetivos de missão, recuperação de persistência e bloqueio de física dos modelos visuais. O teste numérico não substitui ensaio manual completo de todas as aeronaves.

Scripts: `pnpm exec tsx --test lib/sim/engine.test.ts`, `pnpm exec tsc --noEmit`, `pnpm build`.
