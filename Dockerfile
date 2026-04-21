FROM eclipse-temurin:17-jre

LABEL maintainer="school-check"

WORKDIR /app

COPY target/School_Check-0.0.1-SNAPSHOT.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
