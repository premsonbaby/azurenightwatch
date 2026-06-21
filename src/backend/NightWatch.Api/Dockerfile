FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/backend/NightWatch.Api/NightWatch.Api.csproj", "src/backend/NightWatch.Api/"]
COPY ["src/backend/NightWatch.Application/NightWatch.Application.csproj", "src/backend/NightWatch.Application/"]
COPY ["src/backend/NightWatch.Domain/NightWatch.Domain.csproj", "src/backend/NightWatch.Domain/"]
COPY ["src/backend/NightWatch.Infrastructure/NightWatch.Infrastructure.csproj", "src/backend/NightWatch.Infrastructure/"]
RUN dotnet restore "src/backend/NightWatch.Api/NightWatch.Api.csproj"
COPY . .
RUN dotnet build "src/backend/NightWatch.Api/NightWatch.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/backend/NightWatch.Api/NightWatch.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "NightWatch.Api.dll"]
