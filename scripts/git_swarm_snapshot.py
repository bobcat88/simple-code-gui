import sqlite3
import json
import os
import uuid
from datetime import datetime, timezone

def main():
    project_path = os.getcwd()
    db_path = os.path.expanduser("~/.config/com.simplecode.gui/app.db")
    
    if not os.path.exists(db_path):
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Generate Snapshot ID
    snapshot_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Try to get last commit message as name
    try:
        import subprocess
        name = subprocess.check_output(["git", "log", "-1", "--pretty=%B"], encoding="utf-8").strip().split("\n")[0]
        name = f"Commit: {name}"
    except:
        name = f"Manual Snapshot {timestamp}"

    # 2. Fetch messages for this project that aren't snapshotted
    cursor.execute("""
        SELECT id, timestamp, from_agent, to_agent, message_type, content, metadata 
        FROM swarm_messages 
        WHERE project_path = ? AND snapshot_id IS NULL
    """, (project_path,))
    
    rows = cursor.fetchall()
    if not rows:
        conn.close()
        return

    messages = []
    for row in rows:
        messages.append({
            "id": row[0],
            "timestamp": row[1],
            "from_agent": row[2],
            "to_agent": row[3],
            "message_type": row[4],
            "content": row[5],
            "metadata": json.loads(row[6]) if row[6] else None
        })

    # 3. Create Snapshot in DB
    cursor.execute("""
        INSERT INTO swarm_snapshots (id, project_path, timestamp) 
        VALUES (?, ?, ?)
    """, (snapshot_id, project_path, timestamp))

    # 4. Link messages in DB
    cursor.execute("""
        UPDATE swarm_messages 
        SET snapshot_id = ? 
        WHERE project_path = ? AND snapshot_id IS NULL
    """, (snapshot_id, project_path))

    conn.commit()
    conn.close()

    # 5. Save to JSON
    snapshots_dir = os.path.join(project_path, ".kspec", "snapshots")
    if not os.path.exists(snapshots_dir):
        os.makedirs(snapshots_dir)
    
    file_path = os.path.join(snapshots_dir, f"{snapshot_id}.json")
    snapshot_data = {
        "id": snapshot_id,
        "name": name,
        "project_path": project_path,
        "timestamp": timestamp,
        "messages": messages
    }
    
    with open(file_path, "w") as f:
        json.dump(snapshot_data, f, indent=2)
    
    print(f"Cognitive Snapshot created: {snapshot_id}")

if __name__ == "__main__":
    main()
