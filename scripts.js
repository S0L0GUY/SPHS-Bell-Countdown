// Schedule will be loaded from bells.yaml
let BELL_SCHEDULE = {};
let DAY_NAMES = {};
let dataLoaded = false;

async function loadSchedule() {
    try {
        const res = await fetch('bells.yaml');
        if (!res.ok) throw new Error('Failed to fetch bells.yaml: ' + res.status);
        const text = await res.text();
        const data = jsyaml.load(text);
        DAY_NAMES = data.day_names || {};
        BELL_SCHEDULE = data.bell_schedule || {};
        dataLoaded = true;
        updateCountdown();
        setInterval(updateCountdown, 1000);
    } catch (err) {
        console.error(err);
        const statusEl = document.getElementById && document.getElementById('status');
        if (statusEl) statusEl.textContent = 'Failed to load schedule.';
    }
}

let selectedDay = null;
let autoMode = true;

function parseTime(timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period === 'AM' && hours === 12) {
        hours = 0;
    }

    return { hours, minutes };
}

function getTodayDay() {
    const day = new Date().getDay();
    const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'friday', 0: 'sunday' };
    return map[day] || 'monday';
}

function setDay(day, btn) {
    selectedDay = day;
    autoMode = false;
    document.getElementById('currentDayLabel').textContent = DAY_NAMES[day] || '';
    document.getElementById('scheduleTitle').textContent = (DAY_NAMES[day] || '') + ' Schedule';

    // Update buttons
    document.querySelectorAll('.day-btn').forEach((b) => b.classList.remove('active'));
    if (btn && btn.classList) btn.classList.add('active');

    updateCountdown();
}

function getSchedule() {
    if (!dataLoaded) return { type: 'loading', bells: [], name: 'Loading' };

    if (autoMode) {
        selectedDay = getTodayDay();
    }

    const day = new Date().getDay();

    // Weekend
    if (day === 0 || day === 6) {
        return { type: 'weekend', bells: [], name: 'Weekend' };
    }

    return { type: 'regular', bells: BELL_SCHEDULE[selectedDay || getTodayDay()] || [], name: DAY_NAMES[selectedDay || getTodayDay()] || '' };
}

function getNextBell(bells, now) {
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // First, check if we're currently in a period with an end time
    for (let i = 0; i < bells.length; i++) {
        const { hours, minutes } = parseTime(bells[i].time);
        const bellMinutes = hours * 60 + minutes;

        if (bells[i].time_end) {
            const { hours: endHours, minutes: endMinutes } = parseTime(bells[i].time_end);
            const endBellMinutes = endHours * 60 + endMinutes;

            if (bellMinutes <= currentTime && currentTime < endBellMinutes) {
                // We're in this period, count to its end time
                return { bell: { ...bells[i], time: bells[i].time_end }, index: i, isEndTime: true };
            }
        }
    }

    // Otherwise, find the next bell by start time
    for (let i = 0; i < bells.length; i++) {
        const { hours, minutes } = parseTime(bells[i].time);
        const bellMinutes = hours * 60 + minutes;

        if (bellMinutes > currentTime) {
            return { bell: bells[i], index: i };
        }
    }

    return { bell: { name: "School Out", time: "Tomorrow" }, index: -1, doneToday: true };
}

function getCurrentPeriod(bells, now) {
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < bells.length; i++) {
        const { hours, minutes } = parseTime(bells[i].time);
        const bellMinutes = hours * 60 + minutes;

        // Check if we're within this period (between start and end time)
        if (bells[i].time_end) {
            const { hours: endHours, minutes: endMinutes } = parseTime(bells[i].time_end);
            const periodEndMinutes = endHours * 60 + endMinutes;
            
            if (bellMinutes <= currentTime && currentTime < periodEndMinutes) {
                return { current: bells[i], next: bells[i + 1] || null, index: i };
            }
        } else if (bellMinutes <= currentTime) {
            // For items without end time, check if next item hasn't started
            const nextBell = bells[i + 1];
            if (!nextBell) {
                return { current: bells[i], next: null, index: i };
            }
            const { hours: nh, minutes: nm } = parseTime(nextBell.time);
            if (nh * 60 + nm > currentTime) {
                return { current: bells[i], next: nextBell, index: i };
            }
        }
    }

    return { current: { name: "Before School", time: bells[0].time }, next: bells[0], index: -1 };
}

function updateCountdown() {
    const now = new Date();
    const schedule = getSchedule();
    const statusEl = document.getElementById('status');
    const bellListEl = document.getElementById('bellList');
    const dayLabelEl = document.getElementById('currentDayLabel');

    // Update day label if in auto mode
    if (autoMode) {
        const todayDay = getTodayDay();
        dayLabelEl.textContent = 'Today - ' + DAY_NAMES[todayDay];
        document.getElementById('scheduleTitle').textContent = 'Today\'s Bell Schedule';

        // Highlight today button
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const todayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'minimum'].indexOf(todayDay);
        document.querySelectorAll('.day-btn')[todayIndex >= 0 && todayIndex <= 4 ? todayIndex : 5].classList.add('active');
    }

    // Populate bell list
    bellListEl.innerHTML = schedule.bells.map((bell, i) => {
        const bellTime = parseTime(bell.time);
        const bellMinutes = bellTime.hours * 60 + bellTime.minutes;
        const currentTime = now.getHours() * 60 + now.getMinutes();

        let isCurrent = false;
        let isPassed = false;

        if (autoMode && bell.time_end) {
            const endTime = parseTime(bell.time_end);
            const endMinutes = endTime.hours * 60 + endTime.minutes;
            
            if (bellMinutes <= currentTime && currentTime < endMinutes) {
                isCurrent = true;
            } else if (endMinutes <= currentTime) {
                isPassed = true;
            }
        }

        let classes = 'bell-item';
        if (isCurrent) classes += ' current';
        if (isPassed && autoMode) classes += ' passed';

        const timeDisplay = bell.time_end ? bell.time + ' - ' + bell.time_end : bell.time;
        return '<div class="' + classes + '"><span class="bell-name">' + bell.name + '</span><span class="bell-time">' + timeDisplay + '</span></div>';
    }).join('');

    if (schedule.type === 'weekend') {
        statusEl.className = 'status not-school-day';
        statusEl.textContent = 'No school today - Enjoy your weekend!';
        document.getElementById('nextBell').textContent = 'Monday';
        document.getElementById('hours').textContent = '--';
        document.getElementById('minutes').textContent = '--';
        document.getElementById('seconds').textContent = '--';
        document.getElementById('periodIndicator').textContent = 'Have a great weekend!';
        return;
    }

    const nextBellData = getNextBell(schedule.bells, now);
    const periodData = getCurrentPeriod(schedule.bells, now);

    if (nextBellData.doneToday) {
        statusEl.className = 'status not-school-day';
        statusEl.textContent = 'School day complete!';
        const tomorrow = BELL_SCHEDULE[getTodayDay()];
        document.getElementById('nextBell').textContent = 'Tomorrow ' + tomorrow[0].time;
        document.getElementById('hours').textContent = '--';
        document.getElementById('minutes').textContent = '--';
        document.getElementById('seconds').textContent = '--';
        document.getElementById('periodIndicator').textContent = 'Last bell: ' + periodData.current.name + ' at ' + periodData.current.time;
        return;
    }

    statusEl.className = 'status school-day';
    statusEl.textContent = 'School in Session';

    const nextBell = nextBellData.bell;
    document.getElementById('nextBell').textContent = nextBell.name;

    if (periodData.current) {
        document.getElementById('periodIndicator').textContent = 'Currently: ' + periodData.current.name + ' | Next: ' + nextBell.name;
    } else {
        document.getElementById('periodIndicator').textContent = 'Next: ' + nextBell.name;
    }

    // Calculate countdown
    const { hours: targetHours, minutes: targetMinutes } = parseTime(nextBell.time);
    const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const targetMinutesTotal = targetHours * 60 + targetMinutes;
    const diffMinutes = targetMinutesTotal - nowMinutes;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = Math.floor(diffMinutes % 60);
    const seconds = Math.floor((diffMinutes * 60) % 60);

    document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
    document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
    document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
}

// Start by loading the schedule then begin updates
loadSchedule();