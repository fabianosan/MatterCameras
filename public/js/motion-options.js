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

    function supportsPersonSensor(root) {
        const addSource = root.dataset.addSource || '';
        if (addSource === 'reolink' || addSource === 'unifi-protect') {
            return true;
        }

        const manufacturer = root.querySelector('[name="manufacturer"]')?.value?.trim().toLowerCase() || '';
        if (includesAny(manufacturer, ['reolink'])) {
            return true;
        }

        const protectHost = root.querySelector('[name="protectHost"]')?.value?.trim() || '';
        const protectCameraId = root.querySelector('[name="protectCameraId"]')?.value?.trim() || '';
        if (protectHost && protectCameraId) {
            return true;
        }

        const inferred = inferAutoGroup(root);
        return inferred === 'reolink-native' || inferred === 'unifi-protect';
    }

    function supportsReolinkLight(root) {
        const capableAttr = root.dataset.reolinkLightCapable;
        if (capableAttr === 'false') {
            return false;
        }

        const addSource = root.dataset.addSource || '';
        if (addSource === 'reolink') {
            return true;
        }

        const manufacturer = root.querySelector('[name="manufacturer"]')?.value?.trim().toLowerCase() || '';
        const model = root.querySelector('[name="model"]')?.value?.trim().toLowerCase() || '';
        if (includesAny(manufacturer, ['reolink']) || includesAny(model, ['reolink'])) {
            return true;
        }

        const inferred = inferAutoGroup(root);
        return inferred === 'reolink-native';
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

    function setReolinkLightCapable(root, capable) {
        if (!root) return;
        root.dataset.reolinkLightCapable = capable === false ? 'false' : capable === true ? 'true' : '';
        syncReolinkLightOption(root);
    }

    function syncReolinkLightOption(root) {
        const group = root.querySelector('.motion-reolink-light-group');
        if (!group) return;

        const capable = supportsReolinkLight(root);
        group.classList.toggle('hidden', !capable);

        if (!capable) {
            const checkbox = group.querySelector('input[type="checkbox"][name="reolinkLightEnabled"]');
            if (checkbox) checkbox.checked = false;
        }
    }

    function syncPersonSensorOption(root) {
        const group = root.querySelector('.motion-person-sensor-group');
        if (!group) return;

        const capable = supportsPersonSensor(root);
        group.classList.toggle('hidden', !capable);

        if (!capable) {
            const checkbox = group.querySelector('input[type="checkbox"][name="personSensorEnabled"]');
            if (checkbox) checkbox.checked = false;
        }
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

        syncPersonSensorOption(root);
        syncReolinkLightOption(root);
    }

    function initMotionOptions() {
        document.querySelectorAll('[data-motion-root]').forEach(root => {
            const select = root.querySelector('.motion-source-select');
            if (!select) return;
            const sync = () => syncMotionPanel(root);
            select.addEventListener('change', sync);
            root.querySelectorAll('[name="protectHost"], [name="protectCameraId"], [name="manufacturer"]')
                .forEach(input => input.addEventListener('input', sync));
            sync();
        });
    }

    window.MatterCamerasMotionOptions = {
        syncMotionPanel,
        initMotionOptions,
        supportsPersonSensor,
        supportsReolinkLight,
        setReolinkLightCapable,
    };
}());
