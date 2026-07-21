-- Expands the role competency knowledge base so the Career Planner has
-- something to plan against for the roles onboarding already offers.
-- Adds Backend Developer, Full Stack Developer, AI Engineer, Cyber Security,
-- and UI/UX Designer, plus the supporting global skills those roles need.

-- New global skills. Existing skills (HTML, CSS, JavaScript, TypeScript,
-- React, Git, SQL, Excel, Python, Data Visualization, Statistics,
-- Machine Learning, Data Cleaning, Model Evaluation, Pandas) are reused
-- where they already cover a competency, so they are not re-inserted here.
insert into public.skills (name, category) values
  ('Node.js', 'backend'),
  ('REST APIs', 'backend'),
  ('Database Design', 'backend'),
  ('System Design', 'backend'),
  ('Docker', 'devops'),
  ('Testing', 'developer_tools'),
  ('Linux', 'developer_tools'),
  ('Deep Learning', 'machine_learning'),
  ('Prompt Engineering', 'machine_learning'),
  ('Vector Databases', 'machine_learning'),
  ('Security Fundamentals', 'security'),
  ('Networking Fundamentals', 'security'),
  ('Cryptography', 'security'),
  ('Penetration Testing', 'security'),
  ('Incident Response', 'security'),
  ('User Research', 'design'),
  ('Wireframing', 'design'),
  ('Prototyping', 'design'),
  ('Visual Design', 'design'),
  ('Interaction Design', 'design'),
  ('Usability Testing', 'design'),
  ('Design Systems', 'design')
on conflict (name) do nothing;

-- Competency mappings for the five new roles. required_level (1-5) is the
-- proficiency a competitive candidate should show; weight reflects how much
-- that skill drives the readiness score for the role (see explanation below).
insert into public.role_competencies (target_role, skill_id, required_level, weight)
select seed.target_role, s.id, seed.required_level, seed.weight
from (values
  -- Backend Developer: API/data layer skills weighted highest, tooling lowest.
  ('Backend Developer', 'REST APIs', 4, 1.5::numeric),
  ('Backend Developer', 'SQL', 4, 1.4::numeric),
  ('Backend Developer', 'Node.js', 4, 1.4::numeric),
  ('Backend Developer', 'Database Design', 4, 1.3::numeric),
  ('Backend Developer', 'System Design', 3, 1.2::numeric),
  ('Backend Developer', 'Python', 3, 1.0::numeric),
  ('Backend Developer', 'Docker', 3, 1.0::numeric),
  ('Backend Developer', 'Git', 3, 0.7::numeric),

  -- Full Stack Developer: frontend + backend core skills both weighted high.
  ('Full Stack Developer', 'JavaScript', 5, 1.5::numeric),
  ('Full Stack Developer', 'React', 4, 1.3::numeric),
  ('Full Stack Developer', 'Node.js', 4, 1.3::numeric),
  ('Full Stack Developer', 'REST APIs', 4, 1.3::numeric),
  ('Full Stack Developer', 'HTML', 4, 0.9::numeric),
  ('Full Stack Developer', 'CSS', 4, 0.9::numeric),
  ('Full Stack Developer', 'TypeScript', 3, 1.0::numeric),
  ('Full Stack Developer', 'SQL', 3, 1.1::numeric),
  ('Full Stack Developer', 'Database Design', 3, 1.0::numeric),
  ('Full Stack Developer', 'Testing', 3, 0.9::numeric),
  ('Full Stack Developer', 'Git', 3, 0.7::numeric),

  -- AI Engineer: applied/production ML skills weighted highest.
  ('AI Engineer', 'Python', 5, 1.5::numeric),
  ('AI Engineer', 'Machine Learning', 4, 1.4::numeric),
  ('AI Engineer', 'Deep Learning', 4, 1.4::numeric),
  ('AI Engineer', 'Prompt Engineering', 4, 1.3::numeric),
  ('AI Engineer', 'Vector Databases', 3, 1.1::numeric),
  ('AI Engineer', 'Model Evaluation', 3, 1.1::numeric),
  ('AI Engineer', 'Pandas', 3, 1.0::numeric),
  ('AI Engineer', 'REST APIs', 3, 0.9::numeric),
  ('AI Engineer', 'Git', 3, 0.7::numeric),

  -- Cyber Security: foundational security knowledge weighted highest.
  ('Cyber Security', 'Security Fundamentals', 4, 1.5::numeric),
  ('Cyber Security', 'Networking Fundamentals', 4, 1.4::numeric),
  ('Cyber Security', 'Linux', 4, 1.3::numeric),
  ('Cyber Security', 'Penetration Testing', 3, 1.3::numeric),
  ('Cyber Security', 'Cryptography', 3, 1.2::numeric),
  ('Cyber Security', 'Incident Response', 3, 1.1::numeric),
  ('Cyber Security', 'Python', 3, 1.0::numeric),
  ('Cyber Security', 'Git', 2, 0.6::numeric),

  -- UI/UX Designer: research and prototyping weighted highest; CSS is a
  -- supporting technical-literacy skill, not a core requirement.
  ('UI/UX Designer', 'User Research', 4, 1.4::numeric),
  ('UI/UX Designer', 'Prototyping', 4, 1.4::numeric),
  ('UI/UX Designer', 'Wireframing', 4, 1.3::numeric),
  ('UI/UX Designer', 'Visual Design', 4, 1.3::numeric),
  ('UI/UX Designer', 'Interaction Design', 3, 1.2::numeric),
  ('UI/UX Designer', 'Usability Testing', 3, 1.2::numeric),
  ('UI/UX Designer', 'Design Systems', 3, 1.1::numeric),
  ('UI/UX Designer', 'CSS', 2, 0.7::numeric)
) as seed(target_role, skill_name, required_level, weight)
join public.skills s on s.name = seed.skill_name
on conflict (target_role, skill_id) do nothing;
