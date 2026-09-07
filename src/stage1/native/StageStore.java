package hotel.shanshui.validation;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.getcapacitor.JSObject;
import java.util.UUID;

final class StageStore extends SQLiteOpenHelper {
    StageStore(Context context) { super(context, "stage1-synthetic.db", null, 1); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE state(id INTEGER PRIMARY KEY CHECK(id=1), amount INTEGER NOT NULL, rows INTEGER NOT NULL, revision INTEGER NOT NULL, restricted INTEGER NOT NULL, request TEXT NOT NULL UNIQUE)");
        db.execSQL("CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT, revision INTEGER NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL)");
        db.execSQL("INSERT INTO state VALUES(1,299900,16,0,0,?)", new Object[]{shortCode()});
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { throw new IllegalStateException("Unknown stage1 schema"); }
    private String shortCode() { return "S1-" + UUID.randomUUID().toString().substring(0,8).toUpperCase(java.util.Locale.ROOT); }
    synchronized JSObject read() {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT amount,rows,revision,restricted,request FROM state WHERE id=1", null)) {
            if (!c.moveToFirst()) throw new IllegalStateException("State missing");
            JSObject o = new JSObject(); boolean restricted = c.getInt(3) == 1;
            o.put("amount",c.getLong(0)); o.put("rows",c.getInt(1));o.put("revision",c.getInt(2));o.put("restricted",restricted);
            com.getcapacitor.JSArray dishes=new com.getcapacitor.JSArray();for(int i=0;i<c.getInt(1);i++)dishes.put(StageExport.dish(i));o.put("dishes",dishes);
            // Internal metadata never crosses the bridge in customer mode.
            if (!restricted) {
                o.put("reference",289900);o.put("request",c.getString(4));
                try (Cursor e = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM events",null)) { e.moveToFirst();o.put("events",e.getInt(0)); }
            }
            return o;
        }
    }
    synchronized void requireSales() { if (read().optBoolean("restricted",true)) throw new IllegalStateException("客户受限状态不能操作内部数据"); }
    synchronized JSObject write(long amount, int rows, boolean fail) {
        requireSales();
        if (amount < 0 || amount > 999999999 || (rows!=1 && rows!=16 && rows!=40 && rows!=100)) throw new IllegalArgumentException("Invalid fixture");
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            int oldRows = read().optInt("rows");
            db.execSQL("UPDATE state SET amount=?,rows=?,revision=revision+1 WHERE id=1", new Object[]{amount,rows});
            if (oldRows != rows) db.execSQL("UPDATE state SET request=? WHERE id=1",new Object[]{shortCode()});
            if (fail) throw new IllegalStateException("注入失败：事务已回滚，重新读取核对版本与金额");
            db.execSQL("INSERT INTO events(revision,kind,at) SELECT revision,'fixture-save',? FROM state",new Object[]{System.currentTimeMillis()});
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        return read();
    }
    synchronized JSObject setRestricted(boolean value) {
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
        try {
            db.execSQL("UPDATE state SET restricted=? WHERE id=1",new Object[]{value?1:0});
            db.execSQL("INSERT INTO events(revision,kind,at) SELECT revision,?,? FROM state",new Object[]{value?"handoff":"recover",System.currentTimeMillis()});
            db.setTransactionSuccessful();
        } finally {db.endTransaction();}
        return read();
    }
    synchronized boolean integrity() {
        try(Cursor c=getReadableDatabase().rawQuery("PRAGMA integrity_check",null)) {return c.moveToFirst() && "ok".equals(c.getString(0));}
    }
}
