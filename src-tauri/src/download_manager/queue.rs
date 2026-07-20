use std::collections::HashMap;
use tokio::sync::Mutex;
use std::sync::Arc;

pub struct QueueManager {
    // Maps task_id to its state or abort handle
    active_tasks: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        Self {
            active_tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn add_task(&self, task_id: String, handle: tokio::task::JoinHandle<()>) {
        let mut tasks = self.active_tasks.lock().await;
        tasks.insert(task_id, handle);
    }

    pub async fn pause_task(&self, task_id: &str) -> Result<(), String> {
        let mut tasks = self.active_tasks.lock().await;
        if let Some(handle) = tasks.remove(task_id) {
            handle.abort();
            Ok(())
        } else {
            Err("Task not found".to_string())
        }
    }
}
