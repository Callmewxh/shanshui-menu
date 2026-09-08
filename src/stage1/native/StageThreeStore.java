package hotel.shanshui.validation;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.*;
import com.getcapacitor.JSObject;
import org.json.JSONObject;

/** SQLite owns the durable Stage 3 state. A failed revision check or write commits nothing. */
final class StageThreeStore extends SQLiteOpenHelper {
  StageThreeStore(Context context){super(context,"stage3-business.db",null,1);}
  @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE business_state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL)");}
  @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){throw new IllegalStateException("未知 Stage 3 schema，拒绝重建");}
  synchronized JSObject read(){try(Cursor cursor=getReadableDatabase().rawQuery("SELECT revision,payload FROM business_state WHERE id=1",null)){if(!cursor.moveToFirst())return new JSObject().put("empty",true).put("revision",0);return new JSObject().put("empty",false).put("revision",cursor.getInt(0)).put("payload",cursor.getString(1));}catch(Exception error){throw new IllegalStateException("Stage 3 SQLite 读取失败",error);}}
  synchronized JSObject commit(String payload,int baseRevision) throws Exception {if(payload==null)throw new IllegalArgumentException("缺少业务快照");new JSONObject(payload);SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{int current=0;try(Cursor cursor=db.rawQuery("SELECT revision FROM business_state WHERE id=1",null)){if(cursor.moveToFirst())current=cursor.getInt(0);}if(current!=baseRevision)throw new IllegalStateException("本地数据已变化，请重新读取");int next=current+1;db.execSQL("INSERT OR REPLACE INTO business_state(id,revision,payload) VALUES(1,?,?)",new Object[]{next,payload});db.setTransactionSuccessful();return new JSObject().put("revision",next);}finally{db.endTransaction();}}
  synchronized void reset(){getWritableDatabase().delete("business_state",null,null);}
}
