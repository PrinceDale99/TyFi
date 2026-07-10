import re

with open('frontend/src/components/LPDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import React, { useRef, useState } from 'react';", "import React, { useRef, useState, useEffect } from 'react';")

with open('frontend/src/components/LPDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added useEffect to LPDashboard")
