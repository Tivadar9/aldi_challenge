using { galactic.spacefarer as domain } from '../db/schema';

@requires: 'SpacefarerUser'
service SpacefarerService {
  @odata.draft.enabled
  @restrict: [{
    grant: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    to: 'SpacefarerUser',
    where: 'originPlanet.ID = $user.planet'
  }]
  
  entity Spacefarers as projection on domain.Spacefarer {
    *,
    case suitColor
      when 'RED' then 'Red'
      when 'BLUE' then 'Blue'
      when 'GREEN' then 'Green'
      when 'BLACK' then 'Black'
      when 'WHITE' then 'White'
      when 'SILVER' then 'Silver'
      when 'GOLD' then 'Gold'
      when 'PURPLE' then 'Purple'
      when 'ORANGE' then 'Orange'
      else suitColor
    end as suitColorText : String(10) @readonly,
    case navigationSkill
      when 0 then 'Beginner'
      when 1 then 'Intermediate'
      when 2 then 'Expert'
      when 3 then 'Master'
    end as navigationSkillText : String(12) @readonly
  };

  @readonly
  entity SuitColors as projection on domain.SuitColorOption;

  @readonly
  entity Planets as projection on domain.Planet;

  @readonly
  entity Departments as projection on domain.Department;

  @readonly
  entity Positions as projection on domain.Position;
}
