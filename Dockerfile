FROM node:22-alpine AS frontend
WORKDIR /client

COPY chatflow-client/package.json chatflow-client/package-lock.json ./
RUN npm ci

COPY chatflow-client/ ./
ENV VITE_API_BASE_URL=/api/
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src

COPY ChatFlow-API/ChatFlow.API.csproj ./
RUN dotnet restore ChatFlow.API.csproj

COPY ChatFlow-API/ ./
RUN dotnet publish ChatFlow.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=backend /app/publish ./
COPY --from=frontend /client/dist ./wwwroot

USER $APP_UID

ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} exec dotnet ChatFlow.API.dll"]