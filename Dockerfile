FROM tomcat:10.1-jdk17

# Rimuovi le app di default di Tomcat
RUN rm -rf /usr/local/tomcat/webapps/*

# Copia il WAR come ROOT (risponde su /)
COPY target/GiocoF.war /usr/local/tomcat/webapps/ROOT.war

EXPOSE 8080

CMD ["catalina.sh", "run"]