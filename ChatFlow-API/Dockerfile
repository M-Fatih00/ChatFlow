# ---- Build aşaması ----
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# csproj'u kopyala ve restore et (katman önbelleği için önce bu)
COPY ChatFlow.API.csproj ./
RUN dotnet restore ChatFlow.API.csproj

# Geri kalan kaynak kodu kopyala ve publish et
COPY . ./
RUN dotnet publish ChatFlow.API.csproj -c Release -o /app/publish

# ---- Runtime aşaması ----
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

# Render, dinlenecek portu PORT ortam değişkeniyle verir.
# Uygulama başlarken bu portu kullanacak şekilde başlatıyoruz.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet ChatFlow.API.dll"]