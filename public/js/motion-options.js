(function () {
    const AUTO_GROUP_BY_SOURCE = {
        'unifi-protect': 'unifi-protect',
        reolink: 'reolink-native',
        'tapo-sonoff': 'onvif',
        onvif: 'onvif',
    };

    const GENERIC_MODES = new Set(['auto', 'frame-diff']);

    function includesAny(value, needles) {
        return needles.some(needle => value.includes(needle));
    }

    function inferAutoGroup(root) {
        const protectHost = root.querySelector('[name="protectHost"]')?.value?.trim().toLowerCase() || '';
        const protectCameraId = root.querySelector('[name="protectCameraId"]')?.value?.trim().toLowerCase() || '';
        if (protectHost || protectCameraId) return 'unifi-protect';

        const manufacturer = root.querySelector('[name="manufacturer"]')?.value?.trim().toLowerCase() || '';
        const model = root.querySelector('[name="model"]')?.value?.trim().toLowerCase() || '';

        if (includesAny(manufacturer, ['reolink']) || includesAny(model, ['reolink'])) {
            return 'reolink-native';
        }

        if (includesAny(manufacturer, ['ubiquiti', 'unifi']) || includesAny(model, ['unifi'])) {
            return 'unifi-protect';
        }

        if (
            includesAny(manufacturer, ['tapo', 'tp-link', 'sonoff'])
            || includesAny(model, ['tapo', 'sonoff'])
        ) {
            return 'onvif';
        }

        const onvifUrl = root.querySelector('[name="onvifUrl"]')?.value?.trim().toLowerCase() || '';
        if (onvifUrl) return 'onvif';

        return AUTO_GROUP_BY_SOURCE[root.dataset.addSource] || '';
    }

    function allowedMotionModes(root) {
        const select = root.querySelector('.motion-source-select');
        const allowed = new Set(GENERIC_MODES);
        const inferred = inferAutoGroup(root);

        if (inferred) {
            allowed.add(inferred);
        } else {
            allowed.add('onvif');
        }

        if (select?.value) {
            allowed.add(select.value);
        }

        return allowed;
    }

    function syncMotionModeOptions(root) {
        const select = root.querySelector('.motion-source-select');
        if (!select) return;

        const allowed = allowedMotionModes(root);
        Array.from(select.options).forEach(option => {
            const visible = allowed.has(option.value);
            option.hidden = !visible;
            option.disabled = !visible;
        });
    }

    function syncMotionPanel(root) {
        const select = root.querySelector('.motion-source-select');
        if (!select) return;

        syncMotionModeOptions(root);

        const mode = select.value;
        const autoGroup = mode === 'auto' ? inferAutoGroup(root) : '';

        root.querySelectorAll('[data-show-for]').forEach(el => {
            const modes = el.dataset.showFor.split(/\s+/);
            const activeMode = mode === 'auto' && el.classList.contains('motion-field-group')
                ? autoGroup
                : mode;
            el.classList.toggle('hidden', !activeMode || !modes.includes(activeMode));
        });
    }

    function initMotionOptions() {
        document.querySelectorAll('[data-motion-root]').forEach(root => {
            const select = root.querySelector('.motion-source-select');
            if (!select) return;
            const sync = () => syncMotionPanel(root);
            select.addEventListener('change', sync);
            sync();
        });
    }

    window.MatterCamerasMotionOptions = {
        syncMotionPanel,
        initMotionOptions,
    };
}());