# ==== 1) Frontend build (React/Vite) ====
FROM node:20 AS frontend
WORKDIR /client

# Bağımlılıkları önce kopyala (katman önbelleği)
COPY chatflow-client/package*.json ./
RUN npm install

# Kaynak kodu kopyala ve build et
COPY chatflow-client/ ./
# Aynı domain: API göreli yoldan çağrılacak
ENV VITE_API_BASE_URL=/api/
RUN npm run build
# Vite çıktısı: /client/dist

# ==== 2) Backend build (.NET) ====
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend
WORKDIR /src

COPY ChatFlow-API/ChatFlow.API.csproj ./
RUN dotnet restore ChatFlow.API.csproj

COPY ChatFlow-API/ ./
RUN dotnet publish ChatFlow.API.csproj -c Release -o /app/publish

# ==== 3) Runtime ====
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Backend publish çıktısı
COPY --from=backend /app/publish ./

# Frontend build çıktısını wwwroot'a koy (backend buradan sunacak)
COPY --from=frontend /client/dist ./wwwroot

# Render PORT verir; ona bağlan
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet ChatFlow.API.dll"]