import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.SQLException;

/**
 * Salva o aggiorna il miglior tempo di un utente per un circuito.
 * Rimpiazza sia SalvaScoreServlet (/Score) che ScoreServlet (/GiocoF/Score),
 * eliminando la duplicazione. Usa ScoreDAO per la logica di persistenza.
 *
 * POST /GiocoF/Score
 *   Parametri: idCircuito (int), tempoMs (long)
 *   Sessione:  userId (obbligatorio)
 */
@WebServlet("/Score")
public class SalvaScoreServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();

        // 1. Legge userId dalla SESSIONE — mai dal body/parametri per sicurezza
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            out.print("{\"ok\":false,\"errore\":\"Non autenticato\"}");
            return;
        }
        int idUtente = (int) session.getAttribute("userId");

        // 2. Legge i parametri
        String idCircuitoStr = request.getParameter("idCircuito");
        String tempoStr      = request.getParameter("tempoMs");

        System.out.println("💾 SalvaScore — userId (sessione): " + idUtente
                + ", idCircuito: " + idCircuitoStr + ", tempoMs: " + tempoStr);

        if (idCircuitoStr == null || idCircuitoStr.isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"idCircuito non fornito\"}");
            return;
        }
        if (tempoStr == null || tempoStr.isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"tempoMs non fornito\"}");
            return;
        }

        try {
            int  idCircuito = Integer.parseInt(idCircuitoStr);
            long tempoMs    = Long.parseLong(tempoStr);
            boolean customMap = "true".equalsIgnoreCase(request.getParameter("customMap")) || "1".equals(request.getParameter("customMap"));

            // ✅ VALIDAZIONE: idCircuito deve essere > 0
            if (idCircuito <= 0) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                System.out.println("❌ SalvaScore: idCircuito non valido: " + idCircuito + " per utente " + idUtente);
                out.print("{\"ok\":false,\"errore\":\"idCircuito non valido\"}");
                return;
            }

            System.out.println("💾 SalvaScore — userId (sessione): " + idUtente
                + ", idCircuito: " + idCircuito + ", tempoMs: " + tempoMs
                + ", customMap: " + customMap);

            int resultCode = ScoreDAO.salvaScore(idUtente, idCircuito, tempoMs, customMap);
            String action;
            switch (resultCode) {
                case 0: action = "inserted"; break;
                case 1: action = "updated"; break;
                default: action = "nochange"; break;
            }
            out.print("{\"ok\":true,\"action\":\"" + action + "\"}");

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            out.print("{\"ok\":false,\"errore\":\"Parametri non validi\"}");
        } catch (SQLException e) {
            System.err.println("❌ SalvaScore SQL: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"ok\":false,\"errore\":\"Errore database\"}");
        } catch (IllegalArgumentException e) {
            // Eccezione da ScoreDAO se mappa non trovata o id non valido
            System.err.println("❌ SalvaScore validazione: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            out.print("{\"ok\":false,\"errore\":\"" + e.getMessage() + "\"}");
        }
    }
}