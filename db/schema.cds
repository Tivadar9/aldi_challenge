namespace galactic.spacefarer;

using { cuid } from '@sap/cds/common';

entity Planet : cuid {
  name        : String(100) not null @mandatory;
  description : String(1000);
}

type NavigationSkill : Integer enum {
  BEGINNER     = 0;
  INTERMEDIATE = 1;
  EXPERT       = 2;
  MASTER       = 3;
}

type SuitColor : String(10) enum {
  RED;
  BLUE;
  GREEN;
  BLACK;
  WHITE;
  SILVER;
  GOLD;
  PURPLE;
  ORANGE;
}

entity Department : cuid {
  name        : String(100) not null @mandatory;
  description : String(1000);
  hqPlanet    : Association to one Planet not null @mandatory;
}

entity Position : cuid {
  name        : String(100) not null @mandatory;
  description : String(1000);
  salary      : Decimal(15,2) not null @mandatory @assert.range: [0, _];
}

@assert.unique: { email: [email] }
entity Spacefarer : cuid {
  name            : String(100) not null @mandatory;
  email           : String(255) not null @mandatory
    @assert.format: '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    @assert.format.message: 'Enter a valid email address';
  stardust        : Integer not null default 0 @assert.range: [0, _];
  navigationSkill : NavigationSkill not null default #BEGINNER @assert.range @readonly;
  trialTimeMinutes : Integer @assert.range: [10, 60] @readonly;
  suitColor       : SuitColor not null @mandatory @assert.range;
  originPlanet    : Association to one Planet not null @mandatory;
  department      : Association to one Department not null @mandatory @assert.target;
  position        : Association to one Position not null @mandatory @assert.target;
}
