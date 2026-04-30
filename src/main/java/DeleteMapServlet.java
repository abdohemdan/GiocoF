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
import org.json.JSONObject;

@WebServlet("/EliminaMappaPersonalizzata")
public class DeleteMapServlet extends HttpServlet {
    
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        
        try {
            // Bug fix + Feature #4: legge userId dalla SESSIONE, non dal parametro POST.
            // Prima era: Integer.parseInt(request.getParameter("userId"))
            // Questo permetteva a chiunque di eliminare mappe altrui modificando userId.
            HttpSession session = request.getSession(false);
            if (session == null || session.getAttribute("userId") == null) {
                JSONObject errore = new JSONObject();
                errore.put("ok", false);
                errore.put("errore", "Non autenticato");
                out.print(errore.toString());
                return;
            }
            int userId = (int) session.getAttribute("userId");
            int mapId = Integer.parseInt(request.getParameter("mapId"));
            
            System.out.println("🗑️ Eliminazione mappa: " + mapId + " utente (da sessione): " + userId);
            
            try (Connection conn = DBConnection.getConnection()) {
                // Verifica che la mappa appartenga all'utente
                String checkSql = "SELECT id FROM mappe_personalizzate WHERE id = ? AND id_utente = ?";
                try (PreparedStatement checkPs = conn.prepareStatement(checkSql)) {
                    checkPs.setInt(1, mapId);
                    checkPs.setInt(2, userId);
                    
                    if (!checkPs.executeQuery().next()) {
                        JSONObject errore = new JSONObject();
                        errore.put("ok", false);
                        errore.put("errore", "Mappa non trovata o non appartiene a te");
                        out.print(errore.toString());
                        return;
                    }
                }
                
                // Elimina la mappa
                String deleteSql = "DELETE FROM mappe_personalizzate WHERE id = ? AND id_utente = ?";
                try (PreparedStatement deletePs = conn.prepareStatement(deleteSql)) {
                    deletePs.setInt(1, mapId);
                    deletePs.setInt(2, userId);
                    
                    int rowsDeleted = deletePs.executeUpdate();
                    
                    if (rowsDeleted > 0) {
                        System.out.println("✅ Mappa eliminata");
                        JSONObject success = new JSONObject();
                        success.put("ok", true);
                        success.put("messaggio", "Mappa eliminata con successo");
                        out.print(success.toString());
                    } else {
                        JSONObject errore = new JSONObject();
                        errore.put("ok", false);
                        errore.put("errore", "Errore durante l'eliminazione");
                        out.print(errore.toString());
                    }
                }
            }
        } catch (Exception e) {
            System.out.println("❌ ERRORE DeleteMap: " + e.getMessage());
            e.printStackTrace();
            JSONObject errore = new JSONObject();
            errore.put("ok", false);
            errore.put("errore", "Errore server: " + e.getMessage());
            out.print(errore.toString());
        }
    }
}