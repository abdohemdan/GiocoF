import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.json.JSONObject;

@WebServlet("/GoogleCallback")
public class GoogleCallbackServlet extends HttpServlet {

    private static final String CLIENT_ID = "288750040588-hsq2eth0pdue8atftbds0ri20gb6fa95.apps.googleusercontent.com";
    private static final String CLIENT_SECRET = "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";
    private static final String REDIRECT_URI = "https://supergiuliokart.onrender.com/GoogleCallback";
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String code = request.getParameter("code");

        if (code == null) {
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().println("Errore: Google non ha restituito il code.");
            return;
        }

        try {
            String tokenResponse = postForm("https://oauth2.googleapis.com/token",
                    "code=" + URLEncoder.encode(code, StandardCharsets.UTF_8.name()) +
                    "&client_id=" + URLEncoder.encode(CLIENT_ID, StandardCharsets.UTF_8.name()) +
                    "&client_secret=" + URLEncoder.encode(CLIENT_SECRET, StandardCharsets.UTF_8.name()) +
                    "&redirect_uri=" + URLEncoder.encode(REDIRECT_URI, StandardCharsets.UTF_8.name()) +
                    "&grant_type=authorization_code");

            JSONObject jsonToken = new JSONObject(tokenResponse);
            String accessToken = jsonToken.getString("access_token");

            String userInfoResponse = getWithBearer("https://www.googleapis.com/oauth2/v3/userinfo", accessToken);
            JSONObject userInfo = new JSONObject(userInfoResponse);

            String googleId = userInfo.getString("sub");
            String email = userInfo.optString("email", "").toLowerCase();
            String nome = userInfo.optString("name", email.contains("@") ? email.substring(0, email.indexOf("@")) : "Giocatore");

            System.out.println("[GoogleCallback] Google ID: " + googleId + ", Email: " + email + ", Nome: " + nome);

            Utente utente = getUtenteByGoogleId(googleId);
            System.out.println("[GoogleCallback] Cercato per googleId: " + (utente != null ? "TROVATO" : "NON TROVATO"));
            
            if (utente == null) {
                utente = getUtenteByEmail(email);
                System.out.println("[GoogleCallback] Cercato per email: " + (utente != null ? "TROVATO" : "NON TROVATO"));
                
                if (utente != null) {
                    linkGoogleId(googleId, email);
                    Utente alt = getUtenteByGoogleId(googleId);
                    if (alt != null) utente = alt;
                } else {
                    String nakName = buildUniqueNickName(nome, email);
                    System.out.println("[GoogleCallback] Creando nuovo utente con nakName: " + nakName);
                    registerGoogleUser(googleId, email, nakName);
                    Utente alt = getUtenteByGoogleId(googleId);
                    if (alt != null) {
                        utente = alt;
                        System.out.println("[GoogleCallback] Nuovo utente creato e trovato: " + utente.getId());
                    } else {
                        utente = getUtenteByEmail(email);
                        if (utente != null) {
                            System.out.println("[GoogleCallback] Nuovo utente trovato per email: " + utente.getId());
                        } else {
                            System.out.println("[GoogleCallback] ERRORE: Impossibile trovare l'utente dopo registerGoogleUser");
                        }
                    }
                }
            }

            if (utente == null) {
                response.setContentType("text/plain;charset=UTF-8");
                response.getWriter().println("Errore: impossibile autenticare l'utente Google.");
                return;
            }

            loadUserEmail(utente);

            HttpSession session = request.getSession(true);
            session.setAttribute("userId", utente.getId());
            session.setAttribute("nakName", utente.getNome());
            session.setAttribute("email", utente.getEmail());

            // Determina redirect: usa state se presente, altrimenti GIOCO.html
            String state = request.getParameter("state");
            String redirectTarget = "GIOCO.html";
            if (state != null && !state.trim().isEmpty()) {
                try {
                    String decoded = java.net.URLDecoder.decode(state, "UTF-8");
                    // Sicurezza: accetta solo URL relativi al sito (no http/https esterni, no path traversal)
                    // Ammette: nomefile.html, nomefile.html?param=valore&altro=123, /GiocoF/pagina.html?...
                    boolean isSafe = !decoded.contains("..") 
                        && !decoded.toLowerCase().startsWith("http")
                        && !decoded.toLowerCase().startsWith("//")
                        && decoded.matches("[\\w\\-\\./%?=&#+]+");
                    if (isSafe) {
                        redirectTarget = decoded;
                    }
                } catch (Exception ignored) {}
            }
            response.sendRedirect(redirectTarget);

        } catch (Exception e) {
            e.printStackTrace();
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().println("Errore autenticazione Google: " + e.getMessage());
        }
    }

    private static String postForm(String urlString, String body) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");

        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }

        int status = conn.getResponseCode();
        BufferedReader br = new BufferedReader(new InputStreamReader(
                status >= 400 ? conn.getErrorStream() : conn.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            response.append(line);
        }
        if (status >= 400) {
            throw new IOException("Google token request failed: " + response.toString());
        }
        return response.toString();
    }

    private static String getWithBearer(String urlString, String accessToken) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", "Bearer " + accessToken);

        int status = conn.getResponseCode();
        BufferedReader br = new BufferedReader(new InputStreamReader(
                status >= 400 ? conn.getErrorStream() : conn.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            response.append(line);
        }
        if (status >= 400) {
            throw new IOException("Google userinfo request failed: " + response.toString());
        }
        return response.toString();
    }

    private static Utente getUtenteByGoogleId(String googleId) throws SQLException {
        String sql = "SELECT id, nak_name FROM utente WHERE google_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, googleId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                Utente u = new Utente();
                u.setId(rs.getInt("id"));
                u.setNome(rs.getString("nak_name"));
                return u;
            }
        } catch (SQLException ex) {
            System.out.println("[getUtenteByGoogleId] Errore: " + ex.getMessage());
            if (ex.getMessage() != null && ex.getMessage().contains("Unknown column")) {
                return null;
            }
            throw ex;
        }
        return null;
    }

    private static Utente getUtenteByEmail(String email) throws SQLException {
        if (email == null || email.isEmpty()) return null;
        String sql = "SELECT id, nak_name FROM utente WHERE email = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                Utente u = new Utente();
                u.setId(rs.getInt("id"));
                u.setNome(rs.getString("nak_name"));
                return u;
            }
        } catch (SQLException ex) {
            System.out.println("[getUtenteByEmail] Errore: " + ex.getMessage());
            if (ex.getMessage() != null && ex.getMessage().contains("Unknown column")) {
                return null;
            }
            throw ex;
        }
        return null;
    }

    private static void linkGoogleId(String googleId, String email) throws SQLException {
        String sql = "UPDATE utente SET google_id = ? WHERE email = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, googleId);
            ps.setString(2, email);
            ps.executeUpdate();
            System.out.println("[linkGoogleId] Linkato google_id all'email: " + email);
        } catch (SQLException ex) {
            System.out.println("[linkGoogleId] Errore: " + ex.getMessage());
            if (ex.getMessage() != null && ex.getMessage().contains("Unknown column")) {
                return;
            }
            throw ex;
        }
    }

    private static void loadUserEmail(Utente utente) {
        try {
            String sql = "SELECT email FROM utente WHERE id = ?";
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, utente.getId());
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    utente.setEmail(rs.getString("email"));
                    System.out.println("[loadUserEmail] Email caricata: " + utente.getEmail());
                }
            }
        } catch (SQLException ex) {
            System.out.println("[loadUserEmail] Errore nel caricare email: " + ex.getMessage());
            utente.setEmail("");
        }
    }

    private static void registerGoogleUser(String googleId, String email, String nakName) throws SQLException {
        // Tenta di inserire con tutte le colonne disponibili
        String sql = "INSERT INTO utente (nak_name, email, google_id) VALUES (?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, nakName);
            ps.setString(2, email);
            ps.setString(3, googleId);
            ps.executeUpdate();
            System.out.println("[registerGoogleUser] Inserito con tutte le colonne");
            return;
        } catch (SQLException ex) {
            System.out.println("[registerGoogleUser] Fallito con tutte le colonne: " + ex.getMessage());
            String msg = ex.getMessage();
            if (msg != null && msg.contains("Unknown column")) {
                try {
                    // Tenta senza google_id e email
                    String fallback = "INSERT INTO utente (nak_name) VALUES (?)";
                    try (Connection conn = DBConnection.getConnection();
                         PreparedStatement ps = conn.prepareStatement(fallback)) {
                        ps.setString(1, nakName);
                        ps.executeUpdate();
                        System.out.println("[registerGoogleUser] Inserito con solo nak_name");
                        return;
                    }
                } catch (SQLException e2) {
                    System.out.println("[registerGoogleUser] Fallito solo nak_name: " + e2.getMessage());
                }
                
                try {
                    // Tenta con email
                    String fallback = "INSERT INTO utente (nak_name, email) VALUES (?, ?)";
                    try (Connection conn = DBConnection.getConnection();
                         PreparedStatement ps = conn.prepareStatement(fallback)) {
                        ps.setString(1, nakName);
                        ps.setString(2, email);
                        ps.executeUpdate();
                        System.out.println("[registerGoogleUser] Inserito con nak_name e email");
                        return;
                    }
                } catch (SQLException e2) {
                    System.out.println("[registerGoogleUser] Fallito nak_name+email: " + e2.getMessage());
                }

                try {
                    // Tenta con google_id
                    String fallback = "INSERT INTO utente (nak_name, google_id) VALUES (?, ?)";
                    try (Connection conn = DBConnection.getConnection();
                         PreparedStatement ps = conn.prepareStatement(fallback)) {
                        ps.setString(1, nakName);
                        ps.setString(2, googleId);
                        ps.executeUpdate();
                        System.out.println("[registerGoogleUser] Inserito con nak_name e google_id");
                        return;
                    }
                } catch (SQLException e2) {
                    System.out.println("[registerGoogleUser] Fallito nak_name+google_id: " + e2.getMessage());
                }
            }
            throw ex;
        }
    }

    private static String buildUniqueNickName(String nome, String email) throws SQLException {
        String base = nome != null ? nome.trim().replaceAll("[^\\w\\-]", "_") : "";
        if (base.isEmpty() && email != null && email.contains("@")) {
            base = email.substring(0, email.indexOf("@"));
        }
        if (base.isEmpty()) {
            base = "Giocatore";
        }
        if (base.length() > 16) {
            base = base.substring(0, 16);
        }

        // Tenta diverse combinazioni finché non trova un nome unico
        String candidate = base + "_" + (int) (Math.random() * 9000 + 1000);
        for (int i = 0; i < 100; i++) {
            String sql = "SELECT id FROM utente WHERE nak_name = ?";
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, candidate);
                ResultSet rs = ps.executeQuery();
                if (!rs.next()) {
                    // Nome unico trovato
                    System.out.println("[buildUniqueNickName] Nome unico trovato: " + candidate);
                    return candidate;
                }
            } catch (SQLException ex) {
                // Se la query fallisce, usa il nome comunque
                System.out.println("[buildUniqueNickName] Errore nella query, usando: " + candidate);
                return candidate;
            }
            candidate = base + "_" + (int) (Math.random() * 9000 + 1000);
        }
        System.out.println("[buildUniqueNickName] Impossibile trovare nome unico dopo 100 tentativi, usando: " + candidate);
        return candidate;
    }
}