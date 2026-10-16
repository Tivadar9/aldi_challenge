using { galactic.spacefarer as domain } from '../db/schema';

@requires: 'SpacefarerUser'
service SpacefarerService {
  @restrict: [{
    grant: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    to: 'SpacefarerUser',
    where: 'originPlanet.ID = $user.planet'
  }]
  entity Spacefarers as projection on domain.Spacefarer;

  @readonly
  entity Planets as projection on domain.Planet;

  @readonly
  entity Departments as projection on domain.Department;

  @readonly
  entity Positions as projection on domain.Position;
}
