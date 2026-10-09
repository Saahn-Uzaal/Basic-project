## build stage ##
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY . .
RUN mvn install -DskipTests=true

## run stage ##
FROM eclipse-temurin:21-jre-alpine

WORKDIR /run

RUN adduser -D app

COPY --from=build /app/target/backend-0.0.1-SNAPSHOT.jar /run/backend-0.0.1-SNAPSHOT.jar

RUN chown -R app:app /run

USER app

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/run/backend-0.0.1-SNAPSHOT.jar"]
