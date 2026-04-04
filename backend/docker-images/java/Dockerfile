FROM eclipse-temurin:21-jdk

WORKDIR /app

RUN useradd -m runner
USER runner

# CMD ["sh", "-c", "javac Main.java && java Main"]
CMD ["sh", "-c", "javac -g:none Main.java && java -Xint Main"]