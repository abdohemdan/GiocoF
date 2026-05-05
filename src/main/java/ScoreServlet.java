import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Stub di compatibilità — delega a SalvaScoreServlet (/Score).
 * Esiste solo per non rompere eventuali chiamate legacy a /Score.
 * Il path attivo usato dal frontend è /Score (mappato su questo servlet)
 * oppure /Score -> SalvaScoreServlet a seconda del deployment.
 *
 * NOTA: nel web.xml o tramite annotation, uno dei due deve vincere.
 * Soluzione adottata: questo servlet fa forward interno a /Score
 * così tutta la logica rimane in SalvaScoreServlet.
 */
@WebServlet("/Score")
public class ScoreServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // Delega all'unico servlet di salvataggio score
        request.getRequestDispatcher("/Score").forward(request, response);
    }
}