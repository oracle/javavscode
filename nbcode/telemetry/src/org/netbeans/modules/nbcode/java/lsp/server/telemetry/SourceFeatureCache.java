/*
 * Copyright (c) 2024-2025, Oracle and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.netbeans.modules.nbcode.java.lsp.server.telemetry;

import java.util.Collections;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.openide.util.NbPreferences;
import org.openide.util.RequestProcessor.Task;

class SourceFeatureCache {

    static class SourceFeatureCacheEntry {

        private final long timestamp;
        private final Set<String> featuresUsed;
        private final AtomicReference<Boolean> previewEnabled; 

        public SourceFeatureCacheEntry(long timestamp, Set<String> featuresUsed) {
            this(timestamp, featuresUsed, null);
        }
        
        protected SourceFeatureCacheEntry(long timestamp, Set<String> featuresUsed, SourceFeatureCacheEntry copy) {
            this.timestamp = timestamp;
            this.featuresUsed = featuresUsed == null ? Collections.emptySet() : featuresUsed;
            this.previewEnabled = new AtomicReference<>(copy == null ? null : copy.previewEnabled.get());
        }

        public long getTimestamp() {
            return timestamp;
        }

        public Set<String> getFeaturesUsed() {
            return featuresUsed;
        }

        public boolean isPreviewEnabled(SourceInfo sourceInfo) {
            Boolean value = previewEnabled.get();
            if (value == null) {
                value = sourceInfo.getPreviewEnabled();
                if (!previewEnabled.compareAndSet(null, value))
                    value = previewEnabled.get();
            }
            return value;
        }
    }

    private static class Singleton {
        private static final int CACHE_EXPIRY = Math.max(0, NbPreferences.forModule(JavaLangFeaturesTelemetryProvider.class).node(JavaLangFeaturesTelemetryProvider.PREFERENCES_NODE).getInt(JavaLangFeaturesTelemetryProvider.PREFERENCES_KEY_CACHE_EXPIRY, 12 * 3_600_000)); // 12 hours
        private static final ConcurrentHashMap<String, SourceFeatureCacheEntry> cachedSourceFeatures = new ConcurrentHashMap<>();
    }

    static ConcurrentHashMap<String, SourceFeatureCacheEntry> getCachedSourceFeatures() {
        return Singleton.cachedSourceFeatures;
    }

    public static SourceFeatureCacheEntry get(String sourceName) {
        return Singleton.cachedSourceFeatures.get(sourceName);
    }
    
    public static boolean add(String sourceName, Set<String> features) {
        final Set<String> newFeatures = Collections.unmodifiableSet(features);
        final SourceFeatureCacheEntry entry = getCachedSourceFeatures().compute(sourceName,
                (name, cache) -> {
                    if (cache != null && cache.getFeaturesUsed().containsAll(newFeatures)) return cache;
                    if (cache != null) features.addAll(cache.getFeaturesUsed());
                    return new SourceFeatureCacheEntry(System.currentTimeMillis(), newFeatures, cache);
                }
        );

        boolean added = newFeatures == entry.getFeaturesUsed();
        if (!added) {
            SourceFeatureCacheCleaner.delay();
        }
        return added;
    }

    private static class SourceFeatureCacheCleaner implements Runnable {

        private static final int CLEANER_DELAY = Math.max(10_000, Singleton.CACHE_EXPIRY / 10);   // 10 times/expiry period; min. 10secs.
        private static final Task cacheCleaner = JavaLangFeaturesTelemetryProvider.getRequestProcessor().create(new SourceFeatureCacheCleaner(), true);

        static {
            cacheCleaner.schedule(CLEANER_DELAY);
        }

        static void delay() {
            cacheCleaner.schedule(CLEANER_DELAY);
        }

        @Override
        public void run() {
            final long cleanBeforeTime = System.currentTimeMillis() - Singleton.CACHE_EXPIRY;
            final Iterator<SourceFeatureCacheEntry> iterator = getCachedSourceFeatures().values().iterator();
            while (iterator.hasNext()) {
                if (iterator.next().getTimestamp() < cleanBeforeTime) {
                    iterator.remove();
                }
            }
            cacheCleaner.schedule(CLEANER_DELAY);
        }

    }
}
