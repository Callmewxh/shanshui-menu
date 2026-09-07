package hotel.shanshui.validation;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(StageOnePlugin.class);
        super.onCreate(state);
        // This validation app has a single root. Back must never reveal an internal history page.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { }
        });
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
}
