export const REGEX = {
    email: /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*[a-zA-Z0-9]@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/,
    username: /^(?![._-])(?!.*[._-]{2})[a-z0-9._-]{5,20}(?<![._-])$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-\[\]{};:,.<>])[A-Za-z\d@$!%*?&#^()_+=\-\[\]{};:,.<>]{8,128}$/,
    code: /^[0-9]{6}$/,
    weight: /^[0-9]{1,3}([.][0-9]{1,2})?$/,
    height: /^[0-9]{1,3}([.][0-9]{1,2})?$/,
    age: /^[0-9]{1,3}$/,
    gender: /^[MF]$/,
};

export const validate = {
    email(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Email is required');
        }

        const normalized = value.trim().toLowerCase();

        if (normalized.length === 0) {
            throw new Error('Email cannot be empty');
        }

        if (!REGEX.email.test(normalized)) {
            throw new Error('Invalid email format');
        }

        return normalized;
    },

    username(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Username is required');
        }

        const normalized = value.trim().toLowerCase();

        if (normalized.length === 0) {
            throw new Error('Username cannot be empty');
        }

        if (normalized.length < 5 || normalized.length > 20) {
            throw new Error('Username must be between 5 and 20 characters');
        }

        if (!REGEX.username.test(normalized)) {
            throw new Error('Username can only contain letters, numbers, dots, underscores and hyphens');
        }

        return normalized;
    },

    password(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Password is required');
        }

        const normalized = value.trim();

        if (normalized.length < 8 || normalized.length > 128) {
            throw new Error('Password must be between 8 and 128 characters');
        }

        if (!REGEX.password.test(normalized)) {
            throw new Error('Password must contain uppercase, lowercase, number and special character');
        }
        return normalized;
    },

    status(value) {
        const validStatuses = ['pending', 'active', 'inactive', 'banned'];

        if (!value || typeof value !== 'string') {
            throw new Error('Status is required');
        }

        const normalized = value.trim().toLowerCase();

        if (!validStatuses.includes(normalized)) {
            throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
        }

        return normalized;
    },

    code(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Code is required');
        }

        const normalized = value.trim();

        if (normalized.length === 0) {
            throw new Error('Code cannot be empty');
        }

        if (!REGEX.code.test(normalized)) {
            throw new Error('Code must be a 6-digit number');
        }

        return normalized;
    },
    height(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Height is required');
        }

        const normalized = value.trim();

        if (normalized.length === 0) {
            throw new Error('Height cannot be empty');
        }

        if (!REGEX.height.test(normalized)) {
            throw new Error('Height must be a number');
        }

        const num = parseFloat(normalized);
        if (num < 50 || num > 250) {
            throw new Error('Height must be between 50 and 250 cm');
        }

        return normalized;
    },
    weight(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Weight is required');
        }

        const normalized = value.trim();

        if (normalized.length === 0) {
            throw new Error('Weight cannot be empty');
        }

        if (!REGEX.weight.test(normalized)) {
            throw new Error('Weight must be a number');
        }

        const num = parseFloat(normalized);
        if (num < 20 || num > 200) {
            throw new Error('Weight must be between 20 and 200 kg');
        }

        return normalized;
    },
    age(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Age is required');
        }

        const normalized = value.trim();

        if (normalized.length === 0) {
            throw new Error('Age cannot be empty');
        }

        if (!REGEX.age.test(normalized)) {
            throw new Error('Age must be a number');
        }

        return normalized;
    },
    gender(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Gender is required');
        }

        const normalized = value.trim().toUpperCase();

        if (normalized.length === 0) {
            throw new Error('Gender cannot be empty');
        }

        if (!REGEX.gender.test(normalized)) {
            throw new Error('Gender must be "M" or "F"');
        }

        return normalized;
    },
};

export const sanitize = (data) => {
    const str = (data ?? '').trim().replace(/\\/g, '');
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}