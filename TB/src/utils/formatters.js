export const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '$ 0';
    const num = parseFloat(value);
    if (isNaN(num)) return '$ 0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num);
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Ensure valid date
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};
