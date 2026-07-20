use std::sync::{Arc, RwLock};
use tokio::sync::Semaphore;

/// A shared, swappable semaphore used to cap the number of downloads that do
/// real work at the same time. Acquiring a permit counts one task against the
/// configured maximum; releasing it (automatically when the permit drops)
/// frees a slot for the next queued task.
pub type Permits = Arc<RwLock<Arc<Semaphore>>>;

pub struct QueueManager {
    permits: Permits,
}

impl QueueManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            permits: Arc::new(RwLock::new(Arc::new(Semaphore::new(
                max_concurrent.max(1),
            )))),
        }
    }

    /// Hand out the shared permits handle so individual downloaders can snapshot
    /// and acquire on it from inside their spawned tasks.
    pub fn permits(&self) -> Permits {
        self.permits.clone()
    }

    /// Replace the semaphore with one of a different capacity. Tasks already
    /// running hold permits on the *old* semaphore (and release them as they
    /// finish); tasks that start afterwards acquire on the new one.
    pub fn set_max(&self, max_concurrent: usize) {
        let mut guard = self.permits.write().unwrap();
        *guard = Arc::new(Semaphore::new(max_concurrent.max(1)));
    }
}
