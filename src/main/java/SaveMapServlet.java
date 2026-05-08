import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import org.json.JSONObject;

@WebServlet("/SalvaMappaPersonalizzata")
public class SaveMapServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        request.setCharacterEncoding("UTF-8");
        response.setContentType("application/json");
        PrintWriter out = response.getWriter();

        // ✅ CORREZIONE: legge userId dalla SESSIONE, non dal parametro POST.
        // Prima era: Integer.parseInt(request.getParameter("userId"))
        // Questo permetteva a un utente di salvare mappe a nome di altri
        // utenti modificando il parametro userId nella richiesta.
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            out.print("{\"ok\":false,\"errore\":\"Non autenticato\"}");
            return;
        }

        int userId = (int) session.getAttribute("userId");

        try {
            String nome       = request.getParameter("nome");
            String mapDataJson = request.getParameter("mapData");
            String mapIdStr   = request.getParameter("mapId"); // opzionale - per aggiornare

            if (nome == null || nome.isEmpty() || mapDataJson == null || mapDataJson.isEmpty()) {
                out.print("{\"ok\":false,\"errore\":\"Nome o mapData mancante\"}");
                return;
            }

            // Rimuovi caratteri di controllo che rompono il JSON parser
// Usa la stringa direttamente senza parsare
String mapData = new String(mapDataJson.getBytes("ISO-8859-1"), "UTF-8");
            try (Connection conn = DBConnection.getConnection()) {
                int mapId = -1;

                // Se mapId è fornito, aggiorna quella mappa
                // (la clausola AND id_utente=? impedisce di modificare mappe altrui)
                if (mapIdStr != null && !mapIdStr.isEmpty()) {
                    int existingId = Integer.parseInt(mapIdStr);
                    String updateSql = "UPDATE mappe_personalizzate " +
                                       "SET nome=?, \"mapData\"=?::jsonb, data_creazione=NOW() " +
                                       "WHERE id=? AND id_utente=?";
                    try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                        ps.setString(1, nome);
                        ps.setString(2, mapData);
ps.setInt(3, existingId);
                        ps.setInt(4, userId);
                        int rows = ps.executeUpdate();
                        if (rows > 0) {
                            mapId = existingId;
                            System.out.println("✅ Mappa aggiornata, ID: " + mapId);
                        }
                    }
                }

                // Se non aggiornata, cerca per nome (stesso utente)
                if (mapId == -1) {
                    String selectSql = "SELECT id FROM mappe_personalizzate " +
                                       "WHERE id_utente=? AND nome=? LIMIT 1";
                    try (PreparedStatement ps = conn.prepareStatement(selectSql)) {
                        ps.setInt(1, userId);
                        ps.setString(2, nome);
                        ResultSet rs = ps.executeQuery();
                        if (rs.next()) {
                            mapId = rs.getInt("id");
                            String updateSql = "UPDATE mappe_personalizzate " +
                                               "SET \"mapData\"=?::jsonb, data_creazione=NOW() WHERE id=?";
                            try (PreparedStatement pu = conn.prepareStatement(updateSql)) {
                                pu.setString(1, mapData);
pu.setInt(2, mapId);
                                pu.executeUpdate();
                                System.out.println("✅ Mappa aggiornata per nome, ID: " + mapId);
                            }
                        }
                    }
                }

                // Se ancora non trovata, inserisci nuova
                if (mapId == -1) {
                    String insertSql = "INSERT INTO mappe_personalizzate " +
                                       "(id_utente, nome, \"mapData\", data_creazione) " +
                                       "VALUES (?, ?, ?::jsonb, NOW())";
                    try (PreparedStatement ps = conn.prepareStatement(
                            insertSql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                        ps.setInt(1, userId);
                        ps.setString(2, nome);
                        ps.setString(3, mapData);
ps.executeUpdate();
                        try (ResultSet rs = ps.getGeneratedKeys()) {
                            if (rs.next()) {
                                mapId = rs.getInt(1);
                                System.out.println("✅ Nuova mappa inserita, ID: " + mapId);
                            }
                        }
                    }
                }

                JSONObject jsonResponse = new JSONObject();
                jsonResponse.put("ok",       true);
                jsonResponse.put("id",       mapId);
                jsonResponse.put("mapId",    mapId);
                jsonResponse.put("messaggio","Mappa salvata!");
                out.print(jsonResponse.toString());
            }

        } catch (Exception e) {
            System.out.println("❌ ERRORE SaveMap: " + e.getMessage());
            out.print("{\"ok\":false,\"errore\":\"" + e.getMessage().replace("\"","'") + "\"}");
        }
    }
}