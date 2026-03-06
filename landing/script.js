document.getElementById('intake-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');

    // Update button state
    submitBtn.disabled = true;
    submitBtn.innerText = 'Starting Review...';

    try {
        const formData = new FormData(form);

        // Simulate API call to local Express server
        const response = await fetch('/api/intake', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();

        // Hide form, show success
        form.classList.add('hidden');
        const successMsg = document.getElementById('successMessage');
        successMsg.classList.remove('hidden');
        successMsg.classList.add('fade-up');

    } catch (err) {
        console.error(err);
        alert('We could not submit your judgment intake. Please try again in a moment.');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Send for Review';
    }
});
