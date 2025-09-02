package org.netbeans.modules.nbcode.java.notebook;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import org.netbeans.modules.java.lsp.server.input.ShowInputBoxParams;

public class CustomInputStreamTest {

    private CustomInputStream inputStream;
    private TestClient mockClient;

    @Before
    public void setUp() {
        mockClient = new TestClient();
        inputStream = new CustomInputStream(mockClient);
    }

    @After
    public void tearDown() {
        inputStream = null;
        mockClient = null;
    }

    @Test
    public void testReadNoClient() throws IOException {
        inputStream.client = null;
        assertEquals(-1, inputStream.read());

        byte[] buffer = new byte[10];
        assertEquals(-1, inputStream.read(buffer, 0, 10));
    }

    @Test
    public void testReadWithInput() throws IOException {
        mockClient.setNextInput("hello");

        byte[] buffer = new byte[1024];
        int bytesRead = inputStream.read(buffer, 0, 1024);
        String readString = new String(buffer, 0, bytesRead, StandardCharsets.UTF_8);
        assertEquals("hello" + System.lineSeparator(), readString);
    }

    @Test
    public void testReadSingleByte() throws IOException {
        mockClient.setNextInput("a");

        int firstByte = inputStream.read();
        assertEquals('a', firstByte);

        int secondByte = inputStream.read();
        assertEquals(System.lineSeparator().charAt(0), (char) secondByte);
    }

    @Test
    public void testMultipleInputs() throws IOException {
        mockClient.setNextInput("first");

        byte[] buffer = new byte[1024];

        int bytesRead1 = inputStream.read(buffer, 0, ("first" + System.lineSeparator()).length());
        String readString1 = new String(buffer, 0, bytesRead1, StandardCharsets.UTF_8);
        assertEquals("first" + System.lineSeparator(), readString1);
        mockClient.setNextInput("second");

        int bytesRead2 = inputStream.read(buffer, 0, ("second" + System.lineSeparator()).length());
        String readString2 = new String(buffer, 0, bytesRead2, StandardCharsets.UTF_8);
        assertEquals("second" + System.lineSeparator(), readString2);
    }
    
    @Test
    public void testNullFutureInput() throws IOException {
        mockClient.setNextInput(null);

        assertEquals(-1, inputStream.read());

        byte[] buffer = new byte[10];
        assertEquals(-1, inputStream.read(buffer, 0, 10));
    }
    
    @Test
    public void testEmptyInput() throws IOException {
        mockClient.setNextInput("");

        byte[] buffer = new byte[1024];
        int bytesRead = inputStream.read(buffer, 0, 1024);
        String readString = new String(buffer, 0, bytesRead, StandardCharsets.UTF_8);
        assertEquals(System.lineSeparator(), readString);
    }

    @Test(expected = IOException.class)
    public void testExecutionException() throws IOException {
        mockClient.setNextException(new RuntimeException("Test failure"));

        inputStream.read();
    }

    @Test
    public void testInterruptedException() {
        final CompletableFuture<String> pendingFuture = new CompletableFuture<>();
        mockClient.setNextFuture(pendingFuture);

        Thread testThread = new Thread(() -> {
            try {
                inputStream.read();
                fail("Should have thrown IOException");
            } catch (IOException e) {
                assertTrue(Thread.currentThread().isInterrupted());
                assertTrue(e.getCause() instanceof InterruptedException);
            }
        });

        testThread.start();
        testThread.interrupt();

        try {
            testThread.join(5000);
        } catch (InterruptedException e) {
            fail("Test interrupted");
        }

        assertTrue("Test thread should have completed", !testThread.isAlive());
    }

    private static class TestClient extends MockNbClient {
        private CompletableFuture<String> nextFuture;

        public void setNextInput(String input) {
            this.nextFuture = CompletableFuture.completedFuture(input);
        }
        

        public void setNextException(Throwable ex) {
            this.nextFuture = new CompletableFuture<>();
            this.nextFuture.completeExceptionally(ex);
        }

        public void setNextFuture(CompletableFuture<String> future) {
            this.nextFuture = future;
        }

        @Override
        public CompletableFuture<String> showInputBox(ShowInputBoxParams params) {
            if (nextFuture != null) {
                CompletableFuture<String> toReturn = nextFuture;
                nextFuture = null;
                return toReturn;
            }
            return null;
        }
    }
}