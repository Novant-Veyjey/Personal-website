(() => {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const colors = ['#ff4f5b', '#ffd26b', '#6de5f5', '#f47bce'];
  const oldPanel = document.getElementById('run-lights');
  if (oldPanel) oldPanel.remove();

  const style = document.createElement('style');
  style.textContent = `
    .letter-lights { position:absolute; inset:5.5% 5.5%; z-index:5; pointer-events:none; border:1px solid rgba(255,75,82,.26); border-radius:22px; }
    .letter-light { position:absolute; display:grid; place-items:center; width:24px; height:24px; transform:translate(-50%,-50%); color:#4c1b20; background:#281116; border:1px solid rgba(255,197,148,.26); border-radius:50%; font:700 8px/1 Arial,sans-serif; transition:background .14s, color .14s, box-shadow .14s, transform .14s; }
    .letter-light.on { color:#fff8d6; background:var(--bulb); transform:translate(-50%,-50%) scale(1.13); box-shadow:0 0 7px 2px var(--bulb), 0 0 18px 5px color-mix(in srgb, var(--bulb) 62%, transparent); }
    .letter-light.sequence { outline:1px solid rgba(255,255,255,.66); outline-offset:3px; }
    .light-command { position:absolute; z-index:7; left:50%; top:10.5%; transform:translateX(-50%); border:1px solid rgba(255,77,87,.55); padding:7px 12px; background:rgba(20,5,8,.82); color:#ffe4cd; font:700 9px/1 Arial,sans-serif; letter-spacing:.18em; cursor:pointer; pointer-events:auto; }
    .light-command[data-running="true"] { background:#a21e2a; box-shadow:0 0 14px rgba(255,44,55,.6); }
    @media(max-width:700px){.letter-light{width:18px;height:18px;font-size:7px}.light-command{top:11%;font-size:8px}}
  `;
  document.head.appendChild(style);

  const frame = document.createElement('div');
  frame.className = 'letter-lights';
  const positions = [
    [5, 4], [16.25, 4], [27.5, 4], [38.75, 4], [50, 4], [61.25, 4], [72.5, 4], [83.75, 4], [95, 4],
    [96, 20], [96, 40], [96, 60], [96, 80],
    [95, 96], [83.75, 96], [72.5, 96], [61.25, 96], [50, 96], [38.75, 96], [27.5, 96], [16.25, 96], [5, 96],
    [4, 80], [4, 60], [4, 40], [4, 20]
  ];
  const bulbs = letters.map((letter, index) => {
    const el = document.createElement('span');
    el.className = 'letter-light';
    el.textContent = letter;
    const [x, y] = positions[index];
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.setProperty('--bulb', colors[index % colors.length]);
    frame.appendChild(el);
    return el;
  });
  const command = document.createElement('button');
  command.className = 'light-command';
  command.type = 'button';
  command.textContent = 'RUN';
  command.title = '进入 R U N 顺序灯光';
  frame.appendChild(command);
  stage.appendChild(frame);

  let ordered = false;
  let orderIndex = 0;
  const r = letters.indexOf('R');
  const u = letters.indexOf('U');
  const n = letters.indexOf('N');
  const sequence = [r, u, n];
  const set = (el, active) => el.classList.toggle('on', active);
  function randomMode() {
    bulbs.forEach((bulb, index) => set(bulb, Math.random() > .61 || index % 7 === 0));
    bulbs.forEach((bulb) => bulb.classList.remove('sequence'));
  }
  function runMode() {
    bulbs.forEach((bulb, index) => set(bulb, index === sequence[orderIndex] || (index + orderIndex) % 9 === 0));
    bulbs.forEach((bulb) => bulb.classList.remove('sequence'));
    bulbs[sequence[orderIndex]].classList.add('sequence');
    orderIndex = (orderIndex + 1) % sequence.length;
  }
  const tick = () => ordered ? runMode() : randomMode();
  tick();
  const timer = window.setInterval(tick, 430);
  window.setTimeout(() => {
    if (ordered) return;
    ordered = true;
    orderIndex = 0;
    command.dataset.running = 'true';
    command.textContent = 'RUNNING';
    tick();
  }, 3200);
  command.addEventListener('click', () => {
    ordered = true;
    orderIndex = 0;
    command.dataset.running = 'true';
    command.textContent = 'RUNNING';
    tick();
  });
  window.addEventListener('beforeunload', () => window.clearInterval(timer), { once:true });
})();
