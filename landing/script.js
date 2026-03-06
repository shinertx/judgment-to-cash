function renderList(target, items) {
  target.innerHTML = '';

  items.forEach((item) => {
    const li = document.createElement('li');
    li.innerText = item;
    target.appendChild(li);
  });
}

function renderTimeline(target, timeline) {
  target.innerHTML = '';

  timeline.forEach((step) => {
    const li = document.createElement('li');
    li.className = 'timeline-item';

    if (step.current) {
      li.classList.add('timeline-item-current');
    } else if (step.completed) {
      li.classList.add('timeline-item-complete');
    }

    li.innerHTML = `<span>${step.state}</span>`;
    target.appendChild(li);
  });
}

const intakeForm = document.getElementById('intake-form');
const lookupForm = document.getElementById('lookup-form');

intakeForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.target;
  const submitBtn = document.getElementById('submitBtn');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Sending...';

  try {
    const formData = new FormData(form);
    const response = await fetch('/api/intake', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();
    const caseResult = data.case;

    form.classList.add('hidden');

    const successMsg = document.getElementById('successMessage');
    successMsg.classList.remove('hidden');

    document.getElementById('successBadge').innerText = caseResult.label;
    document.getElementById('successTitle').innerText = caseResult.headline;
    document.getElementById('successBody').innerText = caseResult.nextStep;
    document.getElementById('successCaseId').innerText = caseResult.id;

    const bulletItems =
      caseResult.summaryBullets && caseResult.summaryBullets.length
        ? caseResult.summaryBullets
        : caseResult.reasons;

    renderList(document.getElementById('successList'), bulletItems);

    document.getElementById('lookupCaseId').value = caseResult.id;
    document.getElementById('lookupEmail').value = formData.get('contactEmail') || '';
  } catch (error) {
    console.error(error);
    alert('We could not submit your judgment intake. Please try again in a moment.');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Send for Review';
  }
});

lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const lookupBtn = document.getElementById('lookupBtn');
  lookupBtn.disabled = true;
  lookupBtn.innerText = 'Checking...';

  try {
    const payload = {
      caseId: document.getElementById('lookupCaseId').value.trim(),
      contactEmail: document.getElementById('lookupEmail').value.trim(),
    };

    const response = await fetch('/api/cases/lookup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Lookup failed');
    }

    const caseResult = data.case;
    const lookupResult = document.getElementById('lookupResult');

    document.getElementById('lookupState').innerText = caseResult.currentState;
    document.getElementById('lookupHeadline').innerText = caseResult.headline;
    document.getElementById('lookupCaseLabel').innerText = `Case ID: ${caseResult.id}`;
    document.getElementById('lookupNextStep').innerText = caseResult.nextStep;

    renderTimeline(document.getElementById('lookupTimeline'), caseResult.timeline || []);
    lookupResult.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    alert(error.message || 'We could not find that case.');
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.innerText = 'Track My Case';
  }
});
