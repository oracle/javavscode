package org.netbeans.modules.nbcode.java.notebook;

import org.eclipse.lsp4j.Position;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author sidsrini
 */
public class NotebookUtilsTest {
    /**
     * Test of normalizeLineEndings method, of class NotebookUtils.
     */
    @Test
    public void testNormalizeLineEndings() {
        assertNull(NotebookUtils.normalizeLineEndings(null));
        assertEquals("", NotebookUtils.normalizeLineEndings(""));
        String expected = "a\nb\nc\n";
        assertEquals(expected, NotebookUtils.normalizeLineEndings(expected));
        assertEquals(expected, NotebookUtils.normalizeLineEndings("a\r\nb\nc\r\n"));
        assertEquals(expected, NotebookUtils.normalizeLineEndings("a\u2028b\rc\u2029"));
        assertEquals(expected, NotebookUtils.normalizeLineEndings("a\rb\rc\r"));
    }

    /**
     * Test of getOffset method, of class NotebookUtils.
     */
    @Test
    public void testGetOffset() {
        assertEquals(0, NotebookUtils.getOffset(null, null));
        assertEquals(0, NotebookUtils.getOffset("", null));
        assertEquals(0, NotebookUtils.getOffset(null, new Position(0, 10)));
        assertEquals(0, NotebookUtils.getOffset("abc", new Position(-1, 0)));
        assertEquals(3, NotebookUtils.getOffset("abc", new Position(0, 10)));
        assertEquals(0, NotebookUtils.getOffset("", new Position(0, 0)));
        assertEquals(0, NotebookUtils.getOffset("", new Position(0, 2)));
        assertEquals(0, NotebookUtils.getOffset("abc", new Position(0, 0)));
        assertEquals(1, NotebookUtils.getOffset("abc", new Position(0, 1)));
        assertEquals(2, NotebookUtils.getOffset("abc", new Position(0, 2)));
        assertEquals(3, NotebookUtils.getOffset("abc", new Position(0, 3)));
        assertEquals(2, NotebookUtils.getOffset("abc\n", new Position(0, 2)));
        assertEquals(3, NotebookUtils.getOffset("abc\n", new Position(0, 3)));
        assertEquals(3, NotebookUtils.getOffset("abc\n", new Position(0, 4)));
        assertEquals(4, NotebookUtils.getOffset("abc\n", new Position(1, 0)));
        assertEquals(4, NotebookUtils.getOffset("abc\n", new Position(1, 1)));
        String multiLine = "abc\n def \nghi jkl\n";
        assertEquals(18, multiLine.length());
        assertEquals(2, NotebookUtils.getOffset(multiLine, new Position(0, 2)));
        assertEquals(4, NotebookUtils.getOffset(multiLine, new Position(1, 0)));
        assertEquals(5, NotebookUtils.getOffset(multiLine, new Position(1, 1)));
        assertEquals(8, NotebookUtils.getOffset(multiLine, new Position(1, 4)));
        assertEquals(9, NotebookUtils.getOffset(multiLine, new Position(1, 5)));
        assertEquals(9, NotebookUtils.getOffset(multiLine, new Position(1, 6)));
        assertEquals(10, NotebookUtils.getOffset(multiLine, new Position(2, -1)));
        assertEquals(10, NotebookUtils.getOffset(multiLine, new Position(2, 0)));
        assertEquals(16, NotebookUtils.getOffset(multiLine, new Position(2, 6)));
        assertEquals(17, NotebookUtils.getOffset(multiLine, new Position(2, 7)));
        assertEquals(17, NotebookUtils.getOffset(multiLine, new Position(2, 8)));
        assertEquals(18, NotebookUtils.getOffset(multiLine, new Position(3, 0)));
        assertEquals(18, NotebookUtils.getOffset(multiLine, new Position(3, 1)));
    }

    /**
     * Test of getPosition method, of class NotebookUtils.
     */
    @Test
    public void testGetPosition() {
        assertEquals(new Position(0, 0), NotebookUtils.getPosition(null, 10));
        assertEquals(new Position(0, 0), NotebookUtils.getPosition("abc", -1));
        assertEquals(new Position(0, 0), NotebookUtils.getPosition("", 0));
        assertEquals(new Position(0, 0), NotebookUtils.getPosition("", 2));
        assertEquals(new Position(0, 0), NotebookUtils.getPosition("abc", 0));
        assertEquals(new Position(0, 1), NotebookUtils.getPosition("abc", 1));
        assertEquals(new Position(0, 2), NotebookUtils.getPosition("abc", 2));
        assertEquals(new Position(0, 3), NotebookUtils.getPosition("abc", 3));
        assertEquals(new Position(0, 2), NotebookUtils.getPosition("abc\n", 2));
        assertEquals(new Position(1, 0), NotebookUtils.getPosition("abc\n", 3));
        assertEquals(new Position(1, 0), NotebookUtils.getPosition("abc\n", 4));
        String multiLine = "abc\n def \nghi jkl\n";
        assertEquals(18, multiLine.length());
        assertEquals(new Position(0, 2), NotebookUtils.getPosition(multiLine, 2));
        assertEquals(new Position(1, 0), NotebookUtils.getPosition(multiLine, 4));
        assertEquals(new Position(1, 1), NotebookUtils.getPosition(multiLine, 5));
        assertEquals(new Position(1, 4), NotebookUtils.getPosition(multiLine, 8));
        assertEquals(new Position(2, 0), NotebookUtils.getPosition(multiLine, 9));
        assertEquals(new Position(2, 0), NotebookUtils.getPosition(multiLine, 10));
        assertEquals(new Position(2, 6), NotebookUtils.getPosition(multiLine, 16));
        assertEquals(new Position(3, 0), NotebookUtils.getPosition(multiLine, 17));
        assertEquals(new Position(3, 0), NotebookUtils.getPosition(multiLine, 18));
    }


    /**
     * Test of applyChange method, of class NotebookUtils.
     */
    @Test
    public void testApplyChange() {
        assertEquals("Invalid range positions", assertThrows(IllegalArgumentException.class, () -> NotebookUtils.applyChange("", new Position(-1, 0), new Position(-1, 0), "")).getMessage());
        assertEquals("Invalid range positions", assertThrows(IllegalArgumentException.class, () -> NotebookUtils.applyChange("", new Position(1, 0), new Position(0, 0), "")).getMessage());
        assertEquals("Invalid range positions", assertThrows(IllegalArgumentException.class, () -> NotebookUtils.applyChange("", new Position(0, 10), new Position(0, 0), "")).getMessage());
        assertEquals("Invalid range start out of bounds", assertThrows(IllegalArgumentException.class, () -> NotebookUtils.applyChange("", new Position(1, 0), new Position(2, 0), "")).getMessage());
        assertEquals("Invalid range end out of bounds", assertThrows(IllegalArgumentException.class, () -> NotebookUtils.applyChange("abc", new Position(0, 0), new Position(1, 0), "")).getMessage());

        String txt = new StringBuilder("abc").toString();
        assertSame(txt, NotebookUtils.applyChange(txt, new Position(0, 1), new Position(0, 1), ""));
        
        assertEquals("abcd", NotebookUtils.applyChange("abc", new Position(0, 3), new Position(0, 3), "d"));
        assertEquals("abcd\n", NotebookUtils.applyChange("abc\n", new Position(0, 3), new Position(0, 3), "d"));
        assertEquals("abcd\n", NotebookUtils.applyChange("abc\n", new Position(0, 4), new Position(0, 6), "d"));
        assertEquals("abc\nd", NotebookUtils.applyChange("abc\n", new Position(1, 0), new Position(1, 0), "d"));
        assertEquals("abc\nd", NotebookUtils.applyChange("abc\n", new Position(1, 0), new Position(1, 3), "d"));
        assertEquals("abcd", NotebookUtils.applyChange("abc\n", new Position(0, 3), new Position(1, 0), "d"));
        assertEquals("abd\n\n", NotebookUtils.applyChange("abc\n", new Position(0, 2), new Position(0, 3), "d\r\n"));
        String multiLine = "abc\n def \nghi jkl\n";
        assertEquals("abc\n def \nghim\njkl\n", NotebookUtils.applyChange(multiLine, new Position(2, 3), new Position(2, 4), "m\n"));
        assertEquals("abc\n def \nghi jkl\nm\n", NotebookUtils.applyChange(multiLine, new Position(3, 0), new Position(3, 0), "m\r\n"));
        assertEquals("abc\n xyz\ndef \nghi\njkl\n", NotebookUtils.applyChange(multiLine, new Position(1, 1), new Position(2, 4), "xyz\ndef \nghi\n"));
        assertEquals("abc\n def \nghi jkl\nmo", NotebookUtils.applyChange(multiLine + "mno", new Position(3, 1), new Position(3, 2), ""));
    }
    
}
