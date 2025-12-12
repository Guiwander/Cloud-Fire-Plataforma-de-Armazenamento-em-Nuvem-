🔥 Cloud Fire – Plataforma de Armazenamento em Nuvem (React + TypeScript + S3)

Cloud Fire é uma plataforma demonstrativa de armazenamento em nuvem inspirada no MediaFire, criada para fins educativos e portfólio. O sistema permite enviar, listar, visualizar e baixar arquivos armazenados em serviços compatíveis com Amazon S3, utilizando o Wasabi Hot Cloud Storage. ste projeto mostra domínio prático de:

🌐 Aplicações Web modernas

👨‍💻 React + TypeScript

☁️ Conceitos de cloud storage

🔐 Segurança de credenciais

🚀 Integração com APIs compatíveis com Amazon S3

🚀 Tecnologias Utilizadas Frontend

React com Vite

TypeScript

Axios

TailwindCSS

React Icons

local Storage

google drive, amazon, Wasabi Hot Cloud (S3 Compatible)

Endpoint: https://s3.wasabisys.com

Bucket privado/público conforme necessidade

Presigned URLs para download seguro

🧩 Funcionalidades ✔️ Upload de arquivos

O usuário seleciona um arquivo e o Cloud Fire envia diretamente para o serviço de storage compatível com S3.

✔️ Listagem de arquivos

O app mostra todos os arquivos presentes no bucket selecionado.

✔️ Download via link

Geração de Presigned URLs (válidos por tempo limitado) para downloads seguros.

✔️ Deleção de arquivos

Remoção simples a partir do frontend.

✔️ Interface moderna

UI/UX inspirada em plataformas profissionais de armazenamento.

Exemplo da Configuração S3 (Wasabi) no Frontend: export const S3_CONFIG = { endpoint: "https://s3.wasabisys.com", bucket: "cloud-fire-demo", region: "us-east-1", };

🔐 Segurança

Nenhuma Access Key/Secret Key aparece no frontend

Apenas o backend manipula credenciais

Download seguro via presigned URLs

Bucket configurado com permissões restritas

⚠️ Aviso Legal

Este projeto é totalmente educacional e serve apenas como demonstração técnica. O autor não se responsabiliza por:

uso indevido

armazenar conteúdo protegido por direitos autorais

armazenamento ilegal de arquivos

O objetivo é aprender cloud computing, React, integração S3 e boas práticas de arquitetura.
