mod poll;

pub trait SerialPortEventHandler: Send + 'static {
    fn handle_event(&mut self);
}

pub trait SerialPortWatcher {
    fn new<F: SerialPortEventHandler>(event_handler: F) -> Self
    where
        Self: Sized;

    fn watch(&mut self) -> ();

    fn unwatch(&mut self) -> ();
}

pub type SerialPortWatcherImpl = poll::SerialPortPollWatcher;
